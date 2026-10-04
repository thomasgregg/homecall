"""Upload, selection, locks, conversion failures and expiring audio delivery."""

import json
import time

import pytest
from aiohttp import web

from custom_components.homecall.const import DOMAIN, MAX_BYTES, TTL
from custom_components.homecall.views import AudioView, UploadView


@pytest.mark.parametrize("targets", [[], ["notify.office_speak"], ["notify.unknown_speak"]])
async def test_rejects_unavailable_or_unknown_target(hass, http_request, devices, targets):
    response = await UploadView(hass).post(http_request(targets=targets))
    assert response.status == 400
    hass.services.async_call.assert_not_awaited()


async def test_upload_without_setup(hass, http_request):
    hass.data.pop(DOMAIN)
    assert (await UploadView(hass).post(http_request())).status == 503


async def test_concurrent_send_returns_conflict(hass, http_request):
    async with hass.data[DOMAIN]["lock"]:
        assert (await UploadView(hass).post(http_request())).status == 409


async def test_rejects_large_content_length(hass, http_request, devices):
    req = http_request(targets=["notify.kitchen_speak"])
    req.content_length = MAX_BYTES + 1
    assert (await UploadView(hass).post(req)).status == 413


async def test_rejects_large_chunked_body(hass, http_request, devices):
    req = http_request(targets=["notify.kitchen_speak"], body=b"0" * (MAX_BYTES + 1))
    req.content_length = None
    assert (await UploadView(hass).post(req)).status == 413


async def test_rejects_invalid_wav(hass, http_request, devices):
    r = await UploadView(hass).post(
        http_request(targets=["notify.kitchen_speak"], body=b"not audio")
    )
    assert r.status == 400
    hass.services.async_call.assert_not_awaited()


async def test_conversion_failure(hass, http_request, devices, wav_bytes, monkeypatch):
    def fail(data):
        raise OSError("encoder unavailable")

    monkeypatch.setattr("custom_components.homecall.views.convert_wav", fail)
    r = await UploadView(hass).post(
        http_request(targets=["notify.kitchen_speak"], body=wav_bytes())
    )
    assert r.status == 500
    assert not hass.data[DOMAIN]["clips"]


async def test_real_upload_and_receipt(hass, http_request, devices, wav_bytes, monkeypatch):
    monkeypatch.setattr(UploadView, "context", lambda self, r: None)
    r = await UploadView(hass).post(
        http_request(targets=["notify.kitchen_speak", "notify.kitchen_speak"], body=wav_bytes())
    )
    assert r.status == 200
    data = json.loads(r.body)
    token = data["receipt"]
    assert len(token) >= 40
    assert data["duration"] == 1
    hass.services.async_call.assert_awaited_once()
    call = hass.services.async_call.call_args
    assert call.args[:2] == ("notify", "send_message")
    assert "/api/homecall/audio/" + token + ".mp3" in call.args[2]["message"]
    audio = await AudioView(hass).get(http_request(), token)
    assert audio.content_type == "audio/mpeg"
    assert audio.headers["Cache-Control"] == "no-store"
    assert len(audio.body) > 0
    assert hass.data[DOMAIN]["clips"][token][2] == 1
    assert time.monotonic() < hass.data[DOMAIN]["clips"][token][0] <= time.monotonic() + TTL


async def test_service_rejection_is_reported(hass, http_request, devices, wav_bytes, monkeypatch):
    monkeypatch.setattr(UploadView, "context", lambda self, r: None)
    hass.services.async_call.side_effect = RuntimeError("unavailable")
    r = await UploadView(hass).post(
        http_request(targets=["notify.kitchen_speak"], body=wav_bytes())
    )
    assert json.loads(r.body)["results"] == [
        {"entity_id": "notify.kitchen_speak", "accepted": False}
    ]


@pytest.mark.parametrize("token", ["unknown", "expired"])
async def test_audio_tokens_expire(hass, http_request, token):
    hass.data[DOMAIN]["clips"]["expired"] = [time.monotonic() - 1, b"audio", 0]
    with pytest.raises(web.HTTPNotFound):
        await AudioView(hass).get(http_request(), token)
