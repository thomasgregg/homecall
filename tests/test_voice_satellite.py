"""Voice Satellite discovery and delivery with simulated browser kiosks."""

import json
from types import SimpleNamespace

import pytest
from homeassistant.components.media_player.const import MediaPlayerEntityFeature as Feature

from custom_components.homecall.const import DOMAIN
from custom_components.homecall.helpers import allowed_targets, dlna_candidates, targets
from custom_components.homecall.views import (
    AudioView,
    SettingsView,
    SpeakerTestView,
    StatusView,
    UploadView,
    deliver,
)

KIOSK = "assist_satellite.kitchen_kiosk"
PLAYER = "media_player.kitchen_kiosk_media_player"


@pytest.fixture
def kiosk(devices, monkeypatch):
    satellite = {
        "entity_id": KIOSK,
        "name": "Kitchen Kiosk",
        "available": True,
        "transport": "voice_satellite",
        "player": PLAYER,
    }
    devices.append(satellite)
    monkeypatch.setattr("custom_components.homecall.views.dlna_candidates", lambda h: [satellite])
    monkeypatch.setattr(UploadView, "context", lambda self, r: None)
    monkeypatch.setattr(SpeakerTestView, "context", lambda self, r: None)
    return satellite


def play_args(token):
    # Root-relative: the card fetches it from the kiosk page's own address,
    # so an HTTPS kiosk works even when HA's internal URL is HTTP.
    return (
        "media_player",
        "play_media",
        {
            "entity_id": PLAYER,
            "media_content_id": f"/api/homecall/audio/{token}.mp3",
            "media_content_type": "audio/mpeg",
            "announce": True,
        },
    )


def test_requires_explicit_selection(hass, entry, kiosk):
    assert kiosk not in allowed_targets(hass, entry)
    entry.options = {"default_targets": [KIOSK]}
    assert kiosk in allowed_targets(hass, entry)


async def test_upload_plays_a_page_relative_clip_on_the_kiosk_player(
    hass, entry, kiosk, http_request, wav_bytes
):
    entry.options = {"default_targets": [KIOSK]}
    response = await UploadView(hass).post(http_request(targets=[KIOSK], body=wav_bytes()))
    result = json.loads(response.body)
    assert result["results"] == [{"entity_id": KIOSK, "accepted": True}]
    call = hass.services.async_call.call_args
    assert call.args == play_args(result["receipt"])
    assert call.kwargs == {"blocking": True, "context": None}
    audio = await AudioView(hass).get(http_request(), result["receipt"])
    assert audio.content_type == "audio/mpeg"
    assert hass.data[DOMAIN]["clips"][result["receipt"]][2] == 1
    assert result["diagnostics"]["deliveries"][0]["transport"] == "voice_satellite"


async def test_rejected_playback_is_reported(hass, entry, kiosk, http_request, wav_bytes):
    hass.services.async_call.side_effect = RuntimeError("Satellite not connected")
    entry.options = {"default_targets": [KIOSK]}
    response = await UploadView(hass).post(http_request(targets=[KIOSK], body=wav_bytes()))
    assert json.loads(response.body)["results"] == [{"entity_id": KIOSK, "accepted": False}]


async def test_sound_test_needs_no_local_or_public_address(
    hass, entry, kiosk, http_request, monkeypatch
):
    entry.data["public_url"] = ""
    monkeypatch.setattr("custom_components.homecall.views.local_url", lambda h, e: "")
    response = await SpeakerTestView(hass).post(
        http_request({"action": "test", "entity_id": KIOSK})
    )
    assert response.status == 200
    result = json.loads(response.body)
    assert result["requires_confirmation"] is False
    assert hass.services.async_call.call_args.args == play_args(result["receipt"])
    hass.config_entries.async_update_entry.assert_not_called()


async def test_chime_is_part_of_the_clip(hass, entry, kiosk, http_request, wav_bytes, monkeypatch):
    entry.options = {"default_targets": [KIOSK], "announcement_chime": True}
    monkeypatch.setattr(
        "custom_components.homecall.views.convert_wav",
        lambda data, prepend=False, cue=None: b"chime-and-voice" if prepend else b"voice",
    )
    monkeypatch.setattr("custom_components.homecall.audio.chime_duration", lambda: 3.0)
    response = await UploadView(hass).post(http_request(targets=[KIOSK], body=wav_bytes()))
    result = json.loads(response.body)
    content = hass.services.async_call.call_args.args[2]["media_content_id"]
    token = content.removeprefix("/api/homecall/audio/").removesuffix(".mp3")
    assert token != result["receipt"]
    assert hass.data[DOMAIN]["clips"][token][1] == b"chime-and-voice"


@pytest.mark.parametrize("missing", [None, "read", "control"])
async def test_nonadmin_needs_access_to_the_kiosk_player(
    hass, entry, kiosk, http_request, wav_bytes, missing
):
    entry.options = {"default_targets": [KIOSK]}
    request = http_request(admin=False, targets=[KIOSK], body=wav_bytes())
    request["hass_user"].permissions = SimpleNamespace(
        check_entity=lambda entity_id, policy: not (entity_id == PLAYER and policy == missing)
    )
    response = await UploadView(hass).post(request)
    if missing is None:
        assert json.loads(response.body)["results"] == [{"entity_id": KIOSK, "accepted": True}]
    else:
        assert response.status == 400
        hass.services.async_call.assert_not_awaited()


@pytest.mark.parametrize("hidden_entity", [KIOSK, PLAYER])
async def test_status_omits_kiosks_if_either_entity_cannot_be_read(
    hass, entry, kiosk, http_request, hidden_entity
):
    entry.options = {"default_targets": [KIOSK]}
    request = http_request(admin=False)
    request["hass_user"].permissions = SimpleNamespace(
        check_entity=lambda entity_id, policy: entity_id != hidden_entity
    )

    response = await StatusView(hass).get(request)

    assert KIOSK not in {target["entity_id"] for target in json.loads(response.body)["targets"]}


async def test_offline_kiosk_is_listed_but_cannot_be_tested_or_sent_to(
    hass, entry, kiosk, http_request, wav_bytes
):
    kiosk["available"] = False
    entry.options = {"default_targets": [KIOSK]}
    status = await StatusView(hass).get(http_request())
    assert not next(
        target for target in json.loads(status.body)["targets"] if target["entity_id"] == KIOSK
    )["available"]

    sound = await SpeakerTestView(hass).post(http_request({"action": "test", "entity_id": KIOSK}))
    send = await UploadView(hass).post(http_request(targets=[KIOSK], body=wav_bytes()))

    assert sound.status == 400
    assert json.loads(sound.body)["error"] == "speaker_unavailable"
    assert send.status == 400
    hass.services.async_call.assert_not_awaited()


@pytest.mark.parametrize("still_discovered", [False, True])
async def test_unavailable_kiosk_is_never_dispatched(
    hass, entry, kiosk, monkeypatch, still_discovered
):
    kiosk["available"] = False
    if not still_discovered:
        monkeypatch.setattr("custom_components.homecall.views.dlna_candidates", lambda h: [])

    result = await deliver(hass, entry, KIOSK, "recording-token")

    hass.services.async_call.assert_not_awaited()
    assert result["accepted"] is False


async def test_saved_missing_kiosk_does_not_block_saving_another_speaker(
    hass, entry, devices, http_request
):
    alexa = devices[0]["entity_id"]
    entry.options = {"added_speakers": [KIOSK], "default_targets": [KIOSK]}
    response = await SettingsView(hass).post(
        http_request(
            {
                "page": "devices",
                "use_all": False,
                "added_speakers": [KIOSK, alexa],
                "default_targets": [KIOSK, alexa],
            }
        )
    )

    assert response.status == 200
    options = hass.config_entries.async_update_entry.call_args.kwargs["options"]
    assert options["default_targets"] == [KIOSK, alexa]
    assert options["added_speakers"] == [KIOSK, alexa]


def test_discovery_identity_capabilities_and_offline(hass, entry, monkeypatch):
    entities, states = {}, {}
    full = Feature.PLAY_MEDIA | Feature.MEDIA_ANNOUNCE
    # (device, satellite state, player features, player state, player disabled)
    for device, satellite_state, features, player_state, disabled in [
        ("kitchen", "idle", full, "idle", None),
        ("hallway", "responding", full, "playing", None),
        ("offline", "unavailable", 0, "unavailable", None),
        ("no_play", "idle", Feature.VOLUME_SET, "idle", None),
        ("player_disabled", "idle", full, "idle", "user"),
        ("no_player", "idle", None, None, None),
    ]:
        satellite = f"assist_satellite.{device}"
        entities[satellite] = SimpleNamespace(
            entity_id=satellite,
            domain="assist_satellite",
            platform="voice_satellite",
            disabled_by=None,
            device_id=device,
            area_id=None,
        )
        states[satellite] = SimpleNamespace(name=device, state=satellite_state, attributes={})
        if features is not None:
            player = f"media_player.{device}_media_player"
            entities[player] = SimpleNamespace(
                entity_id=player,
                domain="media_player",
                platform="voice_satellite",
                disabled_by=disabled,
                device_id=device,
                area_id=None,
            )
            states[player] = SimpleNamespace(
                name=device + " Media Player",
                state=player_state,
                attributes={"supported_features": features},
            )
    # Another integration's satellite and a disabled satellite are ignored.
    for object_id, platform, disabled in [
        ("esphome", "esphome", None),
        ("disabled", "voice_satellite", "user"),
    ]:
        satellite = f"assist_satellite.{object_id}"
        entities[satellite] = SimpleNamespace(
            entity_id=satellite,
            domain="assist_satellite",
            platform=platform,
            disabled_by=disabled,
            device_id="kitchen",
            area_id=None,
        )
        states[satellite] = SimpleNamespace(name=object_id, state="idle", attributes={})
    monkeypatch.setattr(
        "custom_components.homecall.helpers.er.async_get",
        lambda h: SimpleNamespace(entities=entities),
    )
    monkeypatch.setattr(
        "custom_components.homecall.helpers.dr.async_get",
        lambda h: SimpleNamespace(async_get=lambda device_id: None),
    )
    hass.states = SimpleNamespace(get=states.get)
    found = {t["entity_id"]: t for t in dlna_candidates(hass)}
    assert set(found) == {
        "assist_satellite.kitchen",
        "assist_satellite.hallway",
        "assist_satellite.offline",
    }
    assert found["assist_satellite.kitchen"] == {
        "entity_id": "assist_satellite.kitchen",
        "name": "kitchen",
        "available": True,
        "transport": "voice_satellite",
        "player": "media_player.kitchen_media_player",
    }
    assert not found["assist_satellite.offline"]["available"]
    # Added kiosks appear in the card without a DLNA-style confirmation.
    assert len(targets(hass)) == 3
    assert allowed_targets(hass, entry) == []
    entry.options = {"default_targets": ["assist_satellite.kitchen"]}
    assert [t["entity_id"] for t in allowed_targets(hass, entry)] == ["assist_satellite.kitchen"]
