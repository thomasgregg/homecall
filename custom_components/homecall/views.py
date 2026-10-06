"""Authenticated settings, status and uploads; expiring audio download links."""

import asyncio
import secrets
import subprocess
import time
import wave
from xml.sax.saxutils import quoteattr

from aiohttp import web
from homeassistant.auth.permissions.const import POLICY_CONTROL, POLICY_READ
from homeassistant.components.http import HomeAssistantView

from .audio import chime_duration, convert_wav, test_audio, validate_wav
from .const import DELIVERY_TIMEOUT, DOMAIN, MAX_BYTES, TTL, UPLOAD_TIMEOUT
from .diagnostics import elapsed_ms, public_diagnostics, start_diagnostics
from .helpers import allowed_targets, dlna_candidates, local_url, settings, system_url, targets


class HomeCallView(HomeAssistantView):
    def __init__(self, hass):
        self.hass = hass

    def user_targets(self, request, entry, *, control=False):
        """Apply the user's HA permissions as well as HomeCall's global allowlist."""
        devices = allowed_targets(self.hass, entry)
        user = request["hass_user"]
        if user.is_admin:
            return devices
        return [
            device
            for device in devices
            if user.permissions.check_entity(device["entity_id"], POLICY_READ)
            and (not control or user.permissions.check_entity(device["entity_id"], POLICY_CONTROL))
        ]

    def operation_active(self, store, generation):
        return (
            self.hass.data.get(DOMAIN) is store
            and store.get("entry") is not None
            and store.get("generation", 0) == generation
        )


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
        elif page == "announcements":
            for key in ("announcement_chime", "skip_cast_chime"):
                value = payload.get(key)
                if not isinstance(value, bool):
                    raise web.HTTPBadRequest()
                values[key] = value
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
            if "added_speakers" in payload:
                added = payload["added_speakers"]
                if (
                    not isinstance(added, list)
                    or not all(isinstance(x, str) for x in added)
                    or not set(added).issubset(ids)
                ):
                    raise web.HTTPBadRequest()
                values["added_speakers"] = list(dict.fromkeys(added))
            removed_dlna = payload.get("removed_dlna", [])
            if (
                not isinstance(removed_dlna, list)
                or not all(isinstance(x, str) for x in removed_dlna)
                or not set(removed_dlna).issubset(values["tested_dlna"])
                or set(removed_dlna).intersection(selected)
            ):
                raise web.HTTPBadRequest()
            values["tested_dlna"] = [x for x in values["tested_dlna"] if x not in removed_dlna]
            values["resume_dlna"] = [x for x in values["resume_dlna"] if x not in removed_dlna]
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
                removed = (set(values["resume_dlna"]) - set(resume)) | set(removed_dlna)
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
        identifier = request.query.get("diagnostic_id")
        if identifier:
            trace = store.get("diagnostics", {}).get(identifier)
            owner = getattr(request["hass_user"], "id", None)
            if not trace or trace["_expires"] <= time.monotonic() or trace["_owner"] != owner:
                raise web.HTTPNotFound()
            return self.json({"diagnostics": public_diagnostics(trace)})
        receipt = request.query.get("receipt")
        clip = store["clips"].get(receipt) if receipt else None
        return self.json(
            {
                "targets": self.user_targets(request, store["entry"]),
                "default_targets": [],
                "max_seconds": 60,
                "audio_fetches": (clip[4]["audio_fetches"] if len(clip) > 4 else clip[2])
                if clip
                else 0,
                "recorder_protocol": 1,
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
        generation = store.get("generation", 0)
        if store["lock"].locked():
            return self.json({"error": "Eine Durchsage wird gerade gesendet."}, status_code=409)
        selected = request.query.getall("target", [])
        available = {
            item["entity_id"]
            for item in self.user_targets(request, store["entry"], control=True)
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
            trace = start_diagnostics(store, request)
            stage = time.monotonic()
            data = bytearray()
            try:
                async with asyncio.timeout(UPLOAD_TIMEOUT):
                    async for chunk in request.content.iter_chunked(65536):
                        data.extend(chunk)
                        if len(data) > MAX_BYTES:
                            return self.json({"error": "Aufnahme ist zu groß."}, status_code=413)
            except TimeoutError:
                return self.json(
                    {"error": "Zeitlimit beim Hochladen überschritten."}, status_code=408
                )
            trace["timings_ms"]["upload_body_read"] = elapsed_ms(stage)
            stage = time.monotonic()
            try:
                duration = await self.hass.async_add_executor_job(validate_wav, bytes(data))
            except ValueError, wave.Error, EOFError, ZeroDivisionError:
                return self.json(
                    {"error": "Ungültige Aufnahme. Bitte 1 bis 60 Sekunden sprechen."},
                    status_code=400,
                )
            trace["timings_ms"]["validation"] = elapsed_ms(stage)
            values = settings(store["entry"])
            transports = {t["entity_id"]: t["transport"] for t in dlna_candidates(self.hass)}
            chimed_targets = {
                entity_id
                for entity_id in selected
                if values["announcement_chime"]
                and not (values["skip_cast_chime"] and transports.get(entity_id) == "cast")
            }
            stage = time.monotonic()
            try:
                audio = await self.hass.async_add_executor_job(convert_wav, bytes(data))
                chimed_audio = None
                cue_duration = 0
                if chimed_targets:
                    chimed_audio = await self.hass.async_add_executor_job(
                        convert_wav, bytes(data), True
                    )
                    cue_duration = await self.hass.async_add_executor_job(chime_duration)
            except OSError, subprocess.SubprocessError, wave.Error:
                return self.json(
                    {"error": "Audio konnte nicht umgewandelt werden."}, status_code=500
                )
            trace["timings_ms"]["conversion"] = elapsed_ms(stage)
            trace["duration_seconds"] = round(duration, 3)
            if not self.operation_active(store, generation):
                return self.json(
                    {"error": "HomeCall ist noch nicht eingerichtet."}, status_code=503
                )
            # Availability and the admin allowlist can change during upload/encoding.
            available = {
                item["entity_id"]
                for item in self.user_targets(request, store["entry"], control=True)
                if item["available"]
            }
            if not set(selected).issubset(available):
                return self.json(
                    {"error": "Bitte erreichbare Lautsprecher auswählen."}, status_code=400
                )
            now = time.monotonic()
            for key, clip in list(store["clips"].items()):
                if clip[0] <= now:
                    store["clips"].pop(key, None)
            if len(store["clips"]) + (2 if chimed_audio is not None else 1) > 20:
                return self.json(
                    {"error": "Zu viele Durchsagen. Bitte kurz warten."}, status_code=429
                )
            token = secrets.token_urlsafe(32)
            trace["_clip_created"] = now
            trace["_expires"] = now + TTL
            store["clips"][token] = [now + TTL, audio, 0, None, trace]
            asyncio.get_running_loop().call_later(TTL, store["clips"].pop, token, None)
            chimed_token = token
            if chimed_audio is not None:
                chimed_token = secrets.token_urlsafe(32)
                store["clips"][chimed_token] = [now + TTL, chimed_audio, 0, None, trace]
                asyncio.get_running_loop().call_later(TTL, store["clips"].pop, chimed_token, None)

            async def send(index, entity_id):
                if not self.operation_active(store, generation):
                    return {"entity_id": entity_id, "accepted": False}
                return await deliver(
                    self.hass,
                    store["entry"],
                    entity_id,
                    chimed_token if entity_id in chimed_targets else token,
                    self.context(request),
                    duration=duration + (cue_duration if entity_id in chimed_targets else 0),
                    diagnostics=trace,
                    target_index=index,
                )

            results = await asyncio.gather(
                *(send(index, entity_id) for index, entity_id in enumerate(selected, 1))
            )
            return self.json(
                {
                    "results": results,
                    "duration": round(duration, 1),
                    "receipt": token,
                    "diagnostics": public_diagnostics(trace),
                }
            )


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
            if len(clip) > 4:
                trace = clip[4]
                trace["audio_fetches"] += 1
                if "clip_to_first_fetch" not in trace["timings_ms"]:
                    trace["timings_ms"]["clip_to_first_fetch"] = elapsed_ms(trace["_clip_created"])
        return web.Response(
            body=clip[1],
            content_type="audio/mpeg",
            headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
        )


async def deliver(
    hass, entry, entity_id, token, context=None, duration=3, diagnostics=None, target_index=1
):
    """Route only previously validated targets through their actual HA platform."""
    started = time.monotonic()
    transport = "alexa"
    accepted = False
    try:
        candidate = next((t for t in dlna_candidates(hass) if t["entity_id"] == entity_id), None)
        transport = candidate.get("transport", "dlna") if candidate else "alexa"
        dlna = candidate is not None
        sonos = bool(candidate and candidate.get("transport") == "sonos")
        music_assistant = bool(candidate and candidate.get("transport") == "music_assistant")
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
        if music_assistant:
            domain, service = "music_assistant", "play_announcement"
            data = {"url": url, "use_pre_announce": False}
        elif candidate and candidate.get("transport") == "cast":
            data["media_content_type"] = "audio/mpeg"
        elif candidate and candidate.get("transport") == "echomuse":
            data.update(media_content_type="audio/mpeg", announce=True)
        elif sonos:
            data["announce"] = True
        manager = hass.data[DOMAIN].get("resume_manager")
        if dlna and manager:
            if candidate.get("transport") == "dlna" and entity_id in settings(entry)["resume_dlna"]:
                manager.prepare(entity_id, url, duration, context)
            else:
                manager.cancel(entity_id)
        async with asyncio.timeout(DELIVERY_TIMEOUT):
            await hass.services.async_call(
                domain, service, {"entity_id": entity_id, **data}, blocking=True, context=context
            )
        accepted = True
        return {"entity_id": entity_id, "accepted": True}
    except Exception:
        manager = hass.data.get(DOMAIN, {}).get("resume_manager")
        if manager:
            manager.cancel(entity_id)
        return {"entity_id": entity_id, "accepted": False}
    finally:
        if diagnostics is not None:
            diagnostics["deliveries"].append(
                {
                    "target": target_index,
                    "transport": transport,
                    "accepted": accepted,
                    "service_call_ms": elapsed_ms(started),
                }
            )
            diagnostics["deliveries"].sort(key=lambda item: item["target"])


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
        mode = payload.get("mode", "sound")
        if action == "test" and mode != "sound":
            raise web.HTTPBadRequest()
        if not isinstance(entity_id, str):
            raise web.HTTPBadRequest()
        store = self.hass.data[DOMAIN]
        generation = store.get("generation", 0)
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
            (
                t
                for t in [*dlna_candidates(self.hass), *targets(self.hass)]
                if t["entity_id"] == entity_id
            ),
            None,
        )
        if not candidate or not candidate["available"]:
            return self.json({"error": "speaker_unavailable"}, status_code=400)
        requires_confirmation = candidate.get("transport") == "dlna"
        if action == "confirm" and not requires_confirmation:
            raise web.HTTPBadRequest()
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
        address = (
            local_url(self.hass, entry) if candidate.get("transport") else values["public_url"]
        )
        if not address:
            return self.json({"error": "no_local_url"}, status_code=400)
        if store["lock"].locked():
            return self.json({"error": "test_busy"}, status_code=409)
        async with store["lock"]:
            for key, clip in list(store["clips"].items()):
                if clip[0] <= time.monotonic():
                    store["clips"].pop(key, None)
            if len(store["clips"]) >= 20:
                return self.json({"error": "test_busy"}, status_code=429)
            trace = start_diagnostics(store, request)
            trace["test_mode"] = mode
            duration = 3
            trace["duration_seconds"] = duration
            stage = time.monotonic()
            try:
                audio = await self.hass.async_add_executor_job(
                    test_audio,
                )
            except OSError, subprocess.SubprocessError:
                return self.json({"error": "test_failed"}, status_code=500)
            if not self.operation_active(store, generation):
                raise web.HTTPServiceUnavailable()
            token = secrets.token_urlsafe(32)
            trace["timings_ms"]["conversion"] = elapsed_ms(stage)
            trace["_clip_created"] = time.monotonic()
            trace["_expires"] = trace["_clip_created"] + TTL
            store["clips"][token] = [trace["_clip_created"] + TTL, audio, 0, entity_id, trace]
            asyncio.get_running_loop().call_later(TTL, store["clips"].pop, token, None)
            result = await deliver(
                self.hass,
                entry,
                entity_id,
                token,
                self.context(request),
                duration=duration,
                diagnostics=trace,
            )
            if not result["accepted"]:
                store["clips"].pop(token, None)
                return self.json({"error": "test_failed"}, status_code=400)
            return self.json(
                {
                    "receipt": token,
                    "requires_confirmation": requires_confirmation,
                    "diagnostics": public_diagnostics(trace),
                }
            )
