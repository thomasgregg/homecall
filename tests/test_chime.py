"""Global cue defaults, mixed delivery, expiry/privacy and complete audio."""

import asyncio
import io
import json
import subprocess
import time
import wave

import pytest
from aiohttp import web

from custom_components.homecall.audio import CHIME_FILE, chime_duration, convert_wav
from custom_components.homecall.const import DOMAIN
from custom_components.homecall.helpers import settings
from custom_components.homecall.views import AudioView, SettingsView, StatusView, UploadView


def test_defaults(entry):
    assert settings(entry)["announcement_chime"] is False
    assert settings(entry)["skip_cast_chime"] is True


async def test_save_chime_preserves_speakers_and_connection(hass, entry, devices, http_request):
    entry.options = {
        "default_targets": ["notify.kitchen_speak"],
        "resume_dlna": ["media_player.jbl"],
    }
    response = await SettingsView(hass).post(
        http_request(
            {
                "page": "announcements",
                "announcement_chime": True,
                "skip_cast_chime": False,
            }
        )
    )
    values = json.loads(response.body)
    assert values["announcement_chime"] is True
    assert values["skip_cast_chime"] is False
    assert values["public_url"] == "https://ha.example.com"
    assert values["default_targets"] == ["notify.kitchen_speak"]
    assert values["resume_dlna"] == ["media_player.jbl"]


@pytest.mark.parametrize("value", [None, "false", 0, []])
@pytest.mark.parametrize("key", ["announcement_chime", "skip_cast_chime"])
async def test_chime_settings_require_booleans(hass, devices, http_request, key, value):
    payload = {"page": "announcements", "announcement_chime": False, "skip_cast_chime": True}
    payload[key] = value
    with pytest.raises(web.HTTPBadRequest):
        await SettingsView(hass).post(http_request(payload))
    hass.config_entries.async_update_entry.assert_not_called()


@pytest.mark.parametrize("enabled,skip_cast", [(False, True), (True, True), (True, False)])
async def test_mixed_broadcast_has_one_playback_per_route(
    hass, entry, http_request, devices, wav_bytes, monkeypatch, enabled, skip_cast
):
    candidates = [
        {"entity_id": "media_player." + route, "transport": route, "available": True}
        for route in ("dlna", "sonos", "music_assistant", "cast", "echomuse")
    ]
    recipients = [devices[0], *candidates]
    entry.options = {
        "announcement_chime": enabled,
        "skip_cast_chime": skip_cast,
        "resume_dlna": ["media_player.dlna"],
    }
    monkeypatch.setattr("custom_components.homecall.views.allowed_targets", lambda h, e: recipients)
    monkeypatch.setattr("custom_components.homecall.views.dlna_candidates", lambda h: candidates)
    monkeypatch.setattr(UploadView, "context", lambda self, r: None)
    monkeypatch.setattr(
        "custom_components.homecall.views.convert_wav",
        lambda data, prepend=False: b"chime-and-voice" if prepend else b"voice",
    )
    monkeypatch.setattr("custom_components.homecall.views.chime_duration", lambda: 3.0)
    from unittest.mock import Mock

    manager = Mock()
    hass.data[DOMAIN]["resume_manager"] = manager
    response = await UploadView(hass).post(
        http_request(targets=[r["entity_id"] for r in recipients], body=wav_bytes())
    )
    assert response.status == 200
    result = json.loads(response.body)
    assert len(hass.services.async_call.call_args_list) == len(recipients)
    clips = hass.data[DOMAIN]["clips"]
    assert len(clips) == (2 if enabled else 1)
    for call in hass.services.async_call.call_args_list:
        domain, service, data = call.args
        entity = data["entity_id"]
        url = data.get("url", data.get("media_content_id", data.get("message")))
        token = next(token for token in clips if token in url)
        receives_chime = enabled and not (skip_cast and entity == "media_player.cast")
        assert clips[token][1] == (b"chime-and-voice" if receives_chime else b"voice")
        if entity == "media_player.music_assistant":
            assert (domain, service) == ("music_assistant", "play_announcement")
            assert data["use_pre_announce"] is False
        if entity in ("media_player.sonos", "media_player.echomuse"):
            assert data["announce"] is True
        if entity.startswith("notify."):
            assert (domain, service) == ("notify", "send_message")
    assert manager.prepare.call_args.args[2] == (4.0 if enabled else 1.0)
    # Both variants are short-lived and fetch counters combine without exposing URLs.
    for token in clips:
        await AudioView(hass).get(http_request(), token)
        assert clips[token][0] > time.monotonic()
        assert token not in json.dumps(result["diagnostics"])
    request = http_request()
    request.query["receipt"] = result["receipt"]
    assert json.loads((await StatusView(hass).get(request)).body)["audio_fetches"] == len(clips)


@pytest.mark.parametrize("reload", [False, True])
async def test_unload_during_second_encoding_does_not_publish_variants(
    hass, entry, devices, http_request, wav_bytes, monkeypatch, reload
):
    entry.options = {"announcement_chime": True}
    monkeypatch.setattr("custom_components.homecall.views.convert_wav", lambda *args: b"audio")
    blocked, proceed = asyncio.Event(), asyncio.Event()
    executor = hass.async_add_executor_job

    async def delayed(fn, *args):
        if fn.__name__ == "<lambda>" and len(args) == 2:
            blocked.set()
            await proceed.wait()
        return await executor(fn, *args)

    hass.async_add_executor_job = delayed
    task = asyncio.create_task(
        UploadView(hass).post(http_request(targets=["notify.kitchen_speak"], body=wav_bytes()))
    )
    await blocked.wait()
    store = hass.data[DOMAIN]
    if reload:
        store["generation"] = 1
    else:
        store.pop("entry")
    proceed.set()
    assert (await task).status == 503
    assert not store["clips"]
    hass.services.async_call.assert_not_awaited()


def test_full_length_voice_survives_chime_and_resampling(tmp_path):
    import array
    import math

    rate = 48000
    samples = array.array(
        "h", (int(6000 * math.sin(2 * math.pi * 1000 * i / rate)) for i in range(rate * 60))
    )
    data = io.BytesIO()
    with wave.open(data, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(samples.tobytes())
    output = tmp_path / "combined.mp3"
    output.write_bytes(convert_wav(data.getvalue(), True))
    decoded = subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(output),
            "-f",
            "s16le",
            "-ac",
            "1",
            "-ar",
            "24000",
            "pipe:1",
        ],
        check=True,
        capture_output=True,
    ).stdout
    pcm = array.array("h", decoded)
    expected = chime_duration() + 60
    assert len(pcm) / 24000 == pytest.approx(expected, abs=0.1)
    # The final half-second of voice remains audible, after the 60-second mark.
    tail = pcm[int((expected - 0.7) * 24000) : int((expected - 0.2) * 24000)]
    assert max(abs(v) for v in tail) > 4000
    assert CHIME_FILE.is_file()


async def test_cast_only_skip_does_not_encode_or_store_a_chime(
    hass, entry, devices, http_request, wav_bytes, monkeypatch
):
    from unittest.mock import Mock

    entry.options = {"announcement_chime": True}
    cast = {"entity_id": "media_player.cast", "transport": "cast", "available": True}
    monkeypatch.setattr("custom_components.homecall.views.allowed_targets", lambda h, e: [cast])
    monkeypatch.setattr("custom_components.homecall.views.dlna_candidates", lambda h: [cast])
    monkeypatch.setattr(UploadView, "context", lambda self, r: None)
    encoder = Mock(return_value=b"voice")
    monkeypatch.setattr("custom_components.homecall.views.convert_wav", encoder)
    response = await UploadView(hass).post(
        http_request(targets=[cast["entity_id"]], body=wav_bytes())
    )
    assert response.status == 200
    encoder.assert_called_once_with(wav_bytes())
    assert len(hass.data[DOMAIN]["clips"]) == 1


async def test_capacity_reserves_both_variants_before_publishing(
    hass, entry, devices, http_request, wav_bytes, monkeypatch
):
    entry.options = {"announcement_chime": True}
    monkeypatch.setattr("custom_components.homecall.views.convert_wav", lambda *args: b"audio")
    store = hass.data[DOMAIN]
    for index in range(19):
        store["clips"][str(index)] = [time.monotonic() + 100, b"audio", 0]
    response = await UploadView(hass).post(
        http_request(targets=["notify.kitchen_speak"], body=wav_bytes())
    )
    assert response.status == 429
    assert len(store["clips"]) == 19
    hass.services.async_call.assert_not_awaited()


async def test_failed_chime_encoding_does_not_send_voice_without_cue(
    hass, entry, devices, http_request, wav_bytes, monkeypatch
):
    entry.options = {"announcement_chime": True}

    def encoder(data, prepend=False):
        if prepend:
            raise OSError("missing asset")
        return b"voice"

    monkeypatch.setattr("custom_components.homecall.views.convert_wav", encoder)
    response = await UploadView(hass).post(
        http_request(targets=["notify.kitchen_speak"], body=wav_bytes())
    )
    assert response.status == 500
    assert not hass.data[DOMAIN]["clips"]
    hass.services.async_call.assert_not_awaited()
