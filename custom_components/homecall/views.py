"""Authenticated settings, status and uploads; expiring audio download links."""

import asyncio
import secrets
import subprocess
import time
import wave
from xml.sax.saxutils import quoteattr

from aiohttp import web
from homeassistant.components.http import HomeAssistantView

from .audio import convert_wav, validate_wav
from .const import DOMAIN, MAX_BYTES, TTL
from .helpers import allowed_targets, settings, system_url, targets


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
            if automatic and not url:
                return self.json({"error": "no_system_url"}, status_code=400)
            if not isinstance(url, str) or not valid_url(url.strip().rstrip("/")):
                return self.json({"error": "invalid_url"}, status_code=400)
            values["public_url"] = url.strip().rstrip("/")
            values["use_system_url"] = automatic
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
            if not use_all and (not selected or not set(selected).issubset(ids)):
                return self.json({"error": "select_echo"}, status_code=400)
            values["use_all"] = use_all
            # Keep the custom selection while switching to all-device mode.
            values["default_targets"] = list(dict.fromkeys(selected))
        else:
            raise web.HTTPBadRequest()
        self.hass.config_entries.async_update_entry(entry, options={**entry.options, **values})
        return self.json(
            {
                "success": True,
                **values,
                "system_url": system_url(self.hass),
                "targets": targets(self.hass),
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
            return self.json({"error": "Bitte erreichbare Echos auswählen."}, status_code=400)
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
            url = (
                settings(store["entry"], self.hass)["public_url"]
                + "/api/homecall/audio/"
                + token
                + ".mp3"
            )

            async def send(entity_id):
                try:
                    await self.hass.services.async_call(
                        "notify",
                        "send_message",
                        {"entity_id": entity_id, "message": "<audio src=" + quoteattr(url) + "/>"},
                        blocking=True,
                        context=self.context(request),
                    )
                    return {"entity_id": entity_id, "accepted": True}
                except Exception:
                    return {"entity_id": entity_id, "accepted": False}

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
        clip[2] += 1
        return web.Response(
            body=clip[1],
            content_type="audio/mpeg",
            headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
        )
