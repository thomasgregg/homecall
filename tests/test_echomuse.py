"""EchoMuse delivery and selection with simulated speakers."""

import json
from unittest.mock import Mock

import pytest

from custom_components.homecall.const import DOMAIN
from custom_components.homecall.helpers import allowed_targets
from custom_components.homecall.views import AudioView, SpeakerTestView, UploadView


@pytest.fixture
def echomuse(devices, monkeypatch):
    speaker = {
        "entity_id": "media_player.echo",
        "name": "EchoMuse Kitchen",
        "available": True,
        "transport": "echomuse",
    }
    devices.append(speaker)
    monkeypatch.setattr("custom_components.homecall.views.dlna_candidates", lambda h: [speaker])
    monkeypatch.setattr(UploadView, "context", lambda self, r: None)
    monkeypatch.setattr(SpeakerTestView, "context", lambda self, r: None)
    return speaker


def test_requires_explicit_selection(hass, entry, echomuse):
    assert echomuse not in allowed_targets(hass, entry)
    entry.options = {"default_targets": [echomuse["entity_id"]]}
    assert echomuse in allowed_targets(hass, entry)


async def test_upload_and_fetch(hass, entry, echomuse, http_request, wav_bytes):
    eid = echomuse["entity_id"]
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
        "announce": True,
    }
    manager.prepare.assert_not_called()
    audio = await AudioView(hass).get(http_request(), result["receipt"])
    assert audio.content_type == "audio/mpeg"
    assert len(audio.body) > 1000
    assert hass.data[DOMAIN]["clips"][result["receipt"]][2] == 1


async def test_sound_test_without_public_address(hass, entry, echomuse, http_request):
    entry.data["public_url"] = ""
    response = await SpeakerTestView(hass).post(
        http_request({"action": "test", "entity_id": echomuse["entity_id"]})
    )
    assert response.status == 200
    assert json.loads(response.body)["requires_confirmation"] is False
    hass.config_entries.async_update_entry.assert_not_called()


@pytest.mark.parametrize("failure", ["service", "address", "offline"])
async def test_failures(hass, entry, echomuse, http_request, wav_bytes, monkeypatch, failure):
    eid = echomuse["entity_id"]
    entry.options = {"default_targets": [eid]}
    if failure == "service":
        hass.services.async_call.side_effect = RuntimeError("Cast rejected playback")
    elif failure == "address":
        monkeypatch.setattr("custom_components.homecall.views.local_url", lambda h, e: "")
    else:
        echomuse["available"] = False
    response = await UploadView(hass).post(http_request(targets=[eid], body=wav_bytes()))
    if failure == "offline":
        assert response.status == 400
    else:
        assert json.loads(response.body)["results"] == [{"entity_id": eid, "accepted": False}]
    if failure != "service":
        hass.services.async_call.assert_not_awaited()


async def test_mixed_alexa_echomuse(hass, entry, echomuse, http_request, wav_bytes):
    entry.options = {"default_targets": [echomuse["entity_id"]]}
    response = await UploadView(hass).post(
        http_request(targets=["notify.kitchen_speak", echomuse["entity_id"]], body=wav_bytes())
    )
    assert all(r["accepted"] for r in json.loads(response.body)["results"])
    calls = hass.services.async_call.call_args_list
    assert {c.args[0] for c in calls} == {"notify", "media_player"}
    assert len(hass.data[DOMAIN]["clips"]) == 1


def test_discovery_identity_capabilities_and_offline(hass, entry, monkeypatch):
    from types import SimpleNamespace

    from homeassistant.components.media_player.const import MediaPlayerEntityFeature as Feature

    from custom_components.homecall.helpers import dlna_candidates, targets

    entities, states, devices = {}, {}, {}
    full = Feature.PLAY_MEDIA | Feature.MEDIA_ANNOUNCE
    for name, manufacturer, features, state, disabled in [
        ("echo", "EchoMuse", full, "idle", None),
        ("renamed", "echomuse", full, "playing", None),
        ("other", "ESPHome", full, "idle", None),
        ("no_announce", "EchoMuse", Feature.PLAY_MEDIA, "idle", None),
        ("no_play", "EchoMuse", Feature.MEDIA_ANNOUNCE, "idle", None),
        ("offline", "EchoMuse", 0, "unavailable", None),
        ("unknown", "EchoMuse", 0, "unknown", None),
        ("disabled", "EchoMuse", full, "idle", "user"),
        ("orphan", None, full, "idle", None),
    ]:
        eid = "media_player." + name
        entities[eid] = SimpleNamespace(
            entity_id=eid,
            domain="media_player",
            platform="esphome",
            disabled_by=disabled,
            device_id=name,
        )
        states[eid] = SimpleNamespace(
            name=name, state=state, attributes={"supported_features": features}
        )
        if manufacturer:
            devices[name] = SimpleNamespace(manufacturer=manufacturer)
    monkeypatch.setattr(
        "custom_components.homecall.helpers.er.async_get",
        lambda h: SimpleNamespace(entities=entities),
    )
    monkeypatch.setattr(
        "custom_components.homecall.helpers.dr.async_get",
        lambda h: SimpleNamespace(async_get=devices.get),
    )
    hass.states = SimpleNamespace(get=states.get)
    found = dlna_candidates(hass)
    assert {t["name"] for t in found} == {"echo", "renamed", "offline", "unknown"}
    assert all(t["transport"] == "echomuse" for t in found)
    assert not next(t for t in found if t["name"] == "offline")["available"]
    assert len(targets(hass)) == 4
    assert allowed_targets(hass, entry) == []
    entry.options = {"default_targets": ["media_player.offline", "media_player.echo"]}
    assert {t["entity_id"] for t in allowed_targets(hass, entry)} == {
        "media_player.offline",
        "media_player.echo",
    }


async def test_visibility_save_and_removal(hass, entry, echomuse, http_request):
    from custom_components.homecall.views import SettingsView

    eid = echomuse["entity_id"]
    response = await SettingsView(hass).post(
        http_request(
            {"page": "devices", "use_all": True, "default_targets": [eid], "added_speakers": [eid]}
        )
    )
    assert response.status == 200
    entry.options = hass.config_entries.async_update_entry.call_args.kwargs["options"]
    assert echomuse in allowed_targets(hass, entry)
    response = await SpeakerTestView(hass).post(
        http_request({"action": "remove", "entity_id": eid})
    )
    assert response.status == 200
    assert (
        eid
        not in hass.config_entries.async_update_entry.call_args.kwargs["options"]["default_targets"]
    )
