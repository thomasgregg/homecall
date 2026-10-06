"""Timings distinguish service acceptance from audio retrieval without sharing bearer links."""

import asyncio
import json
import time
from unittest.mock import AsyncMock

import pytest
from aiohttp import web

from custom_components.homecall.const import DOMAIN
from custom_components.homecall.views import (
    AudioView,
    SpeakerTestView,
    StatusView,
    UploadView,
    deliver,
)


async def test_timings_and_owner_scoped_retrieval(
    hass, http_request, devices, wav_bytes, monkeypatch
):
    monkeypatch.setattr(UploadView, "context", lambda self, request: None)
    request = http_request(targets=["notify.kitchen_speak"], body=wav_bytes())
    request["hass_user"].id = "owner"
    response = await UploadView(hass).post(request)
    result = json.loads(response.body)
    trace = result["diagnostics"]
    assert set(trace["timings_ms"]) == {"upload_body_read", "validation", "conversion"}
    assert all(value >= 0 for value in trace["timings_ms"].values())
    assert trace["deliveries"][0]["accepted"] is True
    assert trace["deliveries"][0]["transport"] == "alexa"
    assert trace["audio_fetches"] == 0
    assert result["receipt"] not in json.dumps(trace)
    assert "http" not in json.dumps(trace)
    assert "owner" not in json.dumps(trace)
    status = http_request()
    status["hass_user"].id = "other"
    status.query["diagnostic_id"] = trace["diagnostic_id"]
    with pytest.raises(web.HTTPNotFound):
        await StatusView(hass).get(status)
    status["hass_user"].id = "owner"
    assert json.loads((await StatusView(hass).get(status)).body)["diagnostics"] == trace
    fetch = http_request()
    fetch.method = "HEAD"
    await AudioView(hass).get(fetch, result["receipt"])
    assert (
        "clip_to_first_fetch"
        not in hass.data[DOMAIN]["diagnostics"][trace["diagnostic_id"]]["timings_ms"]
    )
    fetch.method = "GET"
    await AudioView(hass).get(fetch, result["receipt"])
    first = json.loads((await StatusView(hass).get(status)).body)["diagnostics"]
    await AudioView(hass).get(fetch, result["receipt"])
    second = json.loads((await StatusView(hass).get(status)).body)["diagnostics"]
    assert first["timings_ms"]["clip_to_first_fetch"] == second["timings_ms"]["clip_to_first_fetch"]
    assert second["audio_fetches"] == 2
    hass.data[DOMAIN]["diagnostics"][trace["diagnostic_id"]]["_expires"] = time.monotonic() - 1
    with pytest.raises(web.HTTPNotFound):
        await StatusView(hass).get(status)


async def test_sound_test_follows_normal_delivery(hass, http_request, devices, monkeypatch):
    monkeypatch.setattr(SpeakerTestView, "context", lambda self, request: None)
    delivery = AsyncMock(wraps=deliver)
    monkeypatch.setattr("custom_components.homecall.views.deliver", delivery)
    response = await SpeakerTestView(hass).post(
        http_request(
            {
                "action": "test",
                "entity_id": "notify.kitchen_speak",
                "mode": "sound",
            }
        )
    )
    result = json.loads(response.body)
    assert result["diagnostics"]["test_mode"] == "sound"
    duration = 3
    assert result["diagnostics"]["duration_seconds"] == duration
    assert delivery.call_args.kwargs["duration"] == duration
    assert result["diagnostics"]["deliveries"][0]["accepted"] is True
    assert hass.services.async_call.call_args.args[:2] == ("notify", "send_message")
    assert result["receipt"] not in json.dumps(result["diagnostics"])


@pytest.mark.parametrize("mode", ["markers", "markers_padded", "unknown"])
async def test_removed_or_unknown_test_modes_are_rejected(hass, http_request, devices, mode):
    with pytest.raises(web.HTTPBadRequest):
        await SpeakerTestView(hass).post(
            http_request(
                {
                    "action": "test",
                    "entity_id": "notify.kitchen_speak",
                    "mode": mode,
                }
            )
        )


@pytest.mark.parametrize("reload", [False, True])
async def test_sound_test_cannot_retain_or_send_audio_after_unload_or_reload(
    hass, http_request, devices, monkeypatch, reload
):
    monkeypatch.setattr(SpeakerTestView, "context", lambda self, request: None)
    encoding, proceed = asyncio.Event(), asyncio.Event()

    async def delayed_executor(fn, *args):
        encoding.set()
        await proceed.wait()
        return b"encoded test"

    hass.async_add_executor_job = delayed_executor
    task = asyncio.create_task(
        SpeakerTestView(hass).post(
            http_request(
                {
                    "action": "test",
                    "entity_id": "notify.kitchen_speak",
                    "mode": "sound",
                }
            )
        )
    )
    await encoding.wait()
    store = hass.data[DOMAIN]
    store["diagnostics"].clear()
    if reload:
        store["generation"] = store.get("generation", 0) + 1
    else:
        store.pop("entry")
    proceed.set()
    with pytest.raises(web.HTTPServiceUnavailable):
        await task
    assert not store["clips"]
    assert not store["diagnostics"]
    hass.services.async_call.assert_not_awaited()
