"""Authenticated settings, status and uploads; expiring audio download links."""

import asyncio
import secrets
import subprocess
import time
import wave
from xml.sax.saxutils import quoteattr

from aiohttp import web
from homeassistant.components.http import HomeAssistantView

from .audio import convert_wav, test_audio, validate_wav
from .const import DOMAIN, MAX_BYTES, TTL
from .helpers import allowed_targets, dlna_candidates, local_url, settings, system_url, targets


class HomeCallView(HomeAssistantView):
    def __init__(self, hass):
        self.hass = hass


class SettingsView(HomeCallView):
    url = "/api/homecall/settings"
    name = "api:homecall:settings"
    requires_auth = True

    def entry(self, request):
        if not request["hass_user"].is_admin:
            raise web.HTTPForbidden()
        entry = self.hass.data.get(DOMAIN, {}).get("entry")
        if entry is None:
            raise web.HTTPServiceUnavailable()
        return entry

    async def get(self, request):
        entry = self.entry(request)
        return self.json(
            {
                **settings(entry, self.hass),
                "system_url": system_url(self.hass),
                "targets": targets(self.hass),
                "dlna_candidates": dlna_candidates(self.hass),
                "detected_local_url": local_url(self.hass, entry),
            }
        )

    async def post(self, request):
        entry = self.entry(request)
        try:
            payload = await request.json()
        except (ValueError, TypeError) as error:
            raise web.HTTPBadRequest() from error
        if not isinstance(payload, dict):
            raise web.HTTPBadRequest()
        values = settings(entry, self.hass)
        page = payload.get("page")
        if page == "connection":
            from .const import valid_url

            automatic = payload.get("use_system_url", False)
            if not isinstance(automatic, bool):
                raise web.HTTPBadRequest()
            url = system_url(self.hass) if automatic else payload.get("public_url")
            needs_public = any(t["entity_id"].startswith("notify.") for t in targets(self.hass))
            if automatic and not url and needs_public:
                return self.json({"error": "no_system_url"}, status_code=400)
            if not isinstance(url, str) or (
                not valid_url(url.strip().rstrip("/")) and (needs_public or url.strip())
            ):
                return self.json({"error": "invalid_url"}, status_code=400)
            values["public_url"] = url.strip().rstrip("/")
            values["use_system_url"] = automatic
            local = payload.get("local_url", values["local_url"])
            from urllib.parse import urlsplit

            if not isinstance(local, str):
                raise web.HTTPBadRequest()
            local = local.strip().rstrip("/")
            try:
                parts = urlsplit(local)
                valid_local = not local or (
                    parts.scheme in ("http", "https")
                    and parts.hostname
                    and not any(
                        (parts.username, parts.password, parts.path, parts.query, parts.fragment)
                    )
                )
            except ValueError:
                valid_local = False
            if not valid_local:
                return self.json({"error": "invalid_local_url"}, status_code=400)
            values["local_url"] = local
        elif page == "devices":
            use_all = payload.get("use_all")
            selected = payload.get("default_targets", [])
            ids = {device["entity_id"] for device in targets(self.hass)}
            if (
                not isinstance(use_all, bool)
                or not isinstance(selected, list)
                or not all(isinstance(x, str) for x in selected)
            ):
                raise web.HTTPBadRequest()
            if not set(selected).issubset(ids):
                return self.json({"error": "select_echo"}, status_code=400)
            values["use_all"] = use_all
            # Keep the custom selection while switching to all-device mode.
            values["default_targets"] = list(dict.fromkeys(selected))
            if "resume_dlna" in payload:
                resume = payload["resume_dlna"]
                if (
                    not isinstance(resume, list)
                    or not all(isinstance(x, str) for x in resume)
                    or not set(resume).issubset(values["tested_dlna"])
                ):
                    raise web.HTTPBadRequest()
                removed = set(values["resume_dlna"]) - set(resume)
                values["resume_dlna"] = list(dict.fromkeys(resume))
                if manager := self.hass.data[DOMAIN].get("resume_manager"):
                    for entity_id in removed:
                        manager.cancel(entity_id)
        else:
            raise web.HTTPBadRequest()
        self.hass.config_entries.async_update_entry(entry, options={**entry.options, **values})
        return self.json(
            {
                "success": True,
                **values,
                "system_url": system_url(self.hass),
                "targets": targets(self.hass),
                "dlna_candidates": dlna_candidates(self.hass),
                "detected_local_url": local_url(self.hass, entry),
            }
        )


class StatusView(HomeCallView):
    url = "/api/homecall/status"
    name = "api:homecall:status"
    requires_auth = True

    async def get(self, request):
        store = self.hass.data.get(DOMAIN)
        if not store or not store.get("entry"):
            return self.json({"error": "HomeCall ist noch nicht eingerichtet."}, status_code=503)
        receipt = request.query.get("receipt")
        clip = store["clips"].get(receipt) if receipt else None
        return self.json(
            {
                "targets": allowed_targets(self.hass, store["entry"]),
                "default_targets": [],
                "max_seconds": 60,
                "audio_fetches": clip[2] if clip else 0,
            }
        )


class UploadView(HomeCallView):
    url = "/api/homecall/send"
    name = "api:homecall:send"
    requires_auth = True

    async def post(self, request):
        store = self.hass.data.get(DOMAIN)
        if not store or not store.get("entry"):
            return self.json({"error": "HomeCall ist noch nicht eingerichtet."}, status_code=503)
        if store["lock"].locked():
            return self.json({"error": "Eine Durchsage wird gerade gesendet."}, status_code=409)
        selected = request.query.getall("target", [])
        available = {
            item["entity_id"]
            for item in allowed_targets(self.hass, store["entry"])
            if item["available"]
        }
        selected = list(dict.fromkeys(selected))
        if not selected or not set(selected).issubset(available):
            return self.json(
                {"error": "Bitte erreichbare Lautsprecher auswählen."}, status_code=400
            )
        if request.content_length and request.content_length > MAX_BYTES:
            return self.json({"error": "Aufnahme ist zu groß."}, status_code=413)
        async with store["lock"]:
            data = bytearray()
            async for chunk in request.content.iter_chunked(65536):
                data.extend(chunk)
                if len(data) > MAX_BYTES:
                    return self.json({"error": "Aufnahme ist zu groß."}, status_code=413)
            try:
                duration = await self.hass.async_add_executor_job(validate_wav, bytes(data))
            except ValueError, wave.Error, EOFError, ZeroDivisionError:
                return self.json(
                    {"error": "Ungültige Aufnahme. Bitte 1 bis 60 Sekunden sprechen."},
                    status_code=400,
                )
            try:
                audio = await self.hass.async_add_executor_job(convert_wav, bytes(data))
            except OSError, subprocess.SubprocessError:
                return self.json(
                    {"error": "Audio konnte nicht umgewandelt werden."}, status_code=500
                )
            now = time.monotonic()
            for key, clip in list(store["clips"].items()):
                if clip[0] <= now:
                    store["clips"].pop(key, None)
            if len(store["clips"]) >= 20:
                return self.json(
                    {"error": "Zu viele Durchsagen. Bitte kurz warten."}, status_code=429
                )
            token = secrets.token_urlsafe(32)
            store["clips"][token] = [now + TTL, audio, 0]
            asyncio.get_running_loop().call_later(TTL, store["clips"].pop, token, None)

            async def send(entity_id):
                return await deliver(
                    self.hass,
                    store["entry"],
                    entity_id,
                    token,
                    self.context(request),
                    duration=duration,
                )

            results = await asyncio.gather(*(send(entity_id) for entity_id in selected))
            return self.json({"results": results, "duration": round(duration, 1), "receipt": token})


class AudioView(HomeCallView):
    url = "/api/homecall/audio/{token}.mp3"
    name = "api:homecall:audio"
    # Alexa cannot authenticate to HA; only a 256-bit random, 3-minute link grants access.
    requires_auth = False

    async def get(self, request, token):
        store = self.hass.data.get(DOMAIN, {})
        clip = store.get("clips", {}).get(token)
        if not clip or clip[0] <= time.monotonic():
            raise web.HTTPNotFound()
        if request.method != "HEAD":
            clip[2] += 1
        return web.Response(
            body=clip[1],
            content_type="audio/mpeg",
            headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
        )


async def deliver(hass, entry, entity_id, token, context=None, duration=3):
    """Route only previously validated targets through their actual HA platform."""
    try:
        candidate = next((t for t in dlna_candidates(hass) if t["entity_id"] == entity_id), None)
        dlna = candidate is not None
        sonos = bool(candidate and candidate.get("transport") == "sonos")
        base = local_url(hass, entry) if dlna else settings(entry, hass)["public_url"]
        if not base:
            raise ValueError("No audio address")
        url = base + "/api/homecall/audio/" + token + ".mp3"
        domain, service = ("media_player", "play_media") if dlna else ("notify", "send_message")
        data = (
            {"media_content_id": url, "media_content_type": "music"}
            if dlna
            else {"message": "<audio src=" + quoteattr(url) + "/>"}
        )
        if sonos:
            data["announce"] = True
        manager = hass.data[DOMAIN].get("resume_manager")
        if dlna and manager:
            if not sonos and entity_id in settings(entry)["resume_dlna"]:
                manager.prepare(entity_id, url, duration, context)
            else:
                manager.cancel(entity_id)
        await hass.services.async_call(
            domain, service, {"entity_id": entity_id, **data}, blocking=True, context=context
        )
        return {"entity_id": entity_id, "accepted": True}
    except Exception:
        manager = hass.data.get(DOMAIN, {}).get("resume_manager")
        if manager:
            manager.cancel(entity_id)
        return {"entity_id": entity_id, "accepted": False}


class SpeakerTestView(SettingsView):
    """Admin-only test, audible confirmation and removal, independent of card visibility."""

    url = "/api/homecall/speaker-test"
    name = "api:homecall:speaker-test"

    async def post(self, request):
        entry = self.entry(request)
        try:
            payload = await request.json()
        except (ValueError, TypeError) as error:
            raise web.HTTPBadRequest() from error
        if not isinstance(payload, dict):
            raise web.HTTPBadRequest()
        entity_id = payload.get("entity_id")
        action = payload.get("action")
        if not isinstance(entity_id, str):
            raise web.HTTPBadRequest()
        store = self.hass.data[DOMAIN]
        values = settings(entry, self.hass)
        if action == "remove":
            values["tested_dlna"] = [x for x in values["tested_dlna"] if x != entity_id]
            values["resume_dlna"] = [x for x in values["resume_dlna"] if x != entity_id]
            manager = store.get("resume_manager")
            if manager:
                manager.cancel(entity_id)
            values["default_targets"] = [x for x in values["default_targets"] if x != entity_id]
            self.hass.config_entries.async_update_entry(entry, options={**entry.options, **values})
            return await self.get(request)
        if action == "resume":
            enabled = payload.get("enabled")
            if not isinstance(enabled, bool) or entity_id not in values["tested_dlna"]:
                raise web.HTTPBadRequest()
            values["resume_dlna"] = [x for x in values["resume_dlna"] if x != entity_id]
            if enabled:
                values["resume_dlna"].append(entity_id)
            elif manager := store.get("resume_manager"):
                manager.cancel(entity_id)
            self.hass.config_entries.async_update_entry(entry, options={**entry.options, **values})
            return await self.get(request)
        candidate = next(
            (t for t in dlna_candidates(self.hass) if t["entity_id"] == entity_id), None
        )
        if not candidate or not candidate["available"]:
            return self.json({"error": "speaker_unavailable"}, status_code=400)
        if action == "confirm":
            receipt = payload.get("receipt")
            if not isinstance(receipt, str):
                raise web.HTTPBadRequest()
            clip = store["clips"].get(receipt)
            if (
                not clip
                or clip[0] <= time.monotonic()
                or len(clip) < 4
                or clip[3] != entity_id
                or not clip[2]
            ):
                return self.json({"error": "test_not_fetched"}, status_code=400)
            values["tested_dlna"] = list(dict.fromkeys([*values["tested_dlna"], entity_id]))
            values["default_targets"] = list(dict.fromkeys([*values["default_targets"], entity_id]))
            self.hass.config_entries.async_update_entry(entry, options={**entry.options, **values})
            store["clips"].pop(receipt, None)
            return await self.get(request)
        if action != "test":
            raise web.HTTPBadRequest()
        if not local_url(self.hass, entry):
            return self.json({"error": "no_local_url"}, status_code=400)
        if store["lock"].locked():
            return self.json({"error": "test_busy"}, status_code=409)
        async with store["lock"]:
            for key, clip in list(store["clips"].items()):
                if clip[0] <= time.monotonic():
                    store["clips"].pop(key, None)
            if len(store["clips"]) >= 20:
                return self.json({"error": "test_busy"}, status_code=429)
            try:
                audio = await self.hass.async_add_executor_job(test_audio)
            except OSError, subprocess.SubprocessError:
                return self.json({"error": "test_failed"}, status_code=500)
            token = secrets.token_urlsafe(32)
            store["clips"][token] = [time.monotonic() + TTL, audio, 0, entity_id]
            asyncio.get_running_loop().call_later(TTL, store["clips"].pop, token, None)
            result = await deliver(self.hass, entry, entity_id, token, self.context(request))
            if not result["accepted"]:
                store["clips"].pop(token, None)
                return self.json({"error": "test_failed"}, status_code=400)
            return self.json({"receipt": token})
