"""Cast delivery and selection with simulated speakers."""

import json
from unittest.mock import Mock

import pytest

from custom_components.homecall.const import DOMAIN
from custom_components.homecall.helpers import allowed_targets
from custom_components.homecall.views import AudioView, SpeakerTestView, UploadView


@pytest.fixture
def cast(devices, monkeypatch):
    speaker = {
        "entity_id": "media_player.nest",
        "name": "Nest Mini",
        "available": True,
        "transport": "cast",
    }
    devices.append(speaker)
    monkeypatch.setattr("custom_components.homecall.views.dlna_candidates", lambda h: [speaker])
    monkeypatch.setattr(UploadView, "context", lambda self, r: None)
    monkeypatch.setattr(SpeakerTestView, "context", lambda self, r: None)
    return speaker


def test_requires_explicit_selection(hass, entry, cast):
    assert cast not in allowed_targets(hass, entry)
    entry.options = {"default_targets": [cast["entity_id"]]}
    assert cast in allowed_targets(hass, entry)


async def test_upload_and_fetch(hass, entry, cast, http_request, wav_bytes):
    eid = cast["entity_id"]
    entry.options = {"default_targets": [eid], "resume_dlna": [eid]}
    manager = Mock()
    hass.data[DOMAIN]["resume_manager"] = manager
    response = await UploadView(hass).post(http_request(targets=[eid], body=wav_bytes()))
    result = json.loads(response.body)
    assert result["results"] == [{"entity_id": eid, "accepted": True}]
    call = hass.services.async_call.call_args
    assert call.args[:2] == ("media_player", "play_media")
    assert call.args[2] == {
        "entity_id": eid,
        "media_content_id": f"http://192.168.1.2:8123/api/homecall/audio/{result['receipt']}.mp3",
        "media_content_type": "audio/mpeg",
    }
    manager.prepare.assert_not_called()
    audio = await AudioView(hass).get(http_request(), result["receipt"])
    assert audio.content_type == "audio/mpeg"
    assert len(audio.body) > 1000
    assert hass.data[DOMAIN]["clips"][result["receipt"]][2] == 1


async def test_sound_test_without_public_address(hass, entry, cast, http_request):
    entry.data["public_url"] = ""
    response = await SpeakerTestView(hass).post(
        http_request({"action": "test", "entity_id": cast["entity_id"]})
    )
    assert response.status == 200
    assert json.loads(response.body)["requires_confirmation"] is False
    hass.config_entries.async_update_entry.assert_not_called()


@pytest.mark.parametrize("failure", ["service", "address", "offline"])
async def test_failures(hass, entry, cast, http_request, wav_bytes, monkeypatch, failure):
    eid = cast["entity_id"]
    entry.options = {"default_targets": [eid]}
    if failure == "service":
        hass.services.async_call.side_effect = RuntimeError("Cast rejected playback")
    elif failure == "address":
        monkeypatch.setattr("custom_components.homecall.views.local_url", lambda h, e: "")
    else:
        cast["available"] = False
    response = await UploadView(hass).post(http_request(targets=[eid], body=wav_bytes()))
    if failure == "offline":
        assert response.status == 400
    else:
        assert json.loads(response.body)["results"] == [{"entity_id": eid, "accepted": False}]
    if failure != "service":
        hass.services.async_call.assert_not_awaited()


async def test_mixed_alexa_cast(hass, entry, cast, http_request, wav_bytes):
    entry.options = {"default_targets": [cast["entity_id"]]}
    response = await UploadView(hass).post(
        http_request(targets=["notify.kitchen_speak", cast["entity_id"]], body=wav_bytes())
    )
    assert all(r["accepted"] for r in json.loads(response.body)["results"])
    calls = hass.services.async_call.call_args_list
    assert {c.args[0] for c in calls} == {"notify", "media_player"}
    assert len(hass.data[DOMAIN]["clips"]) == 1
