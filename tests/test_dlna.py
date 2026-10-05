"""DLNA onboarding and mixed-platform delivery boundaries."""

import json
import time

import pytest
from aiohttp import web

from custom_components.homecall.const import DOMAIN
from custom_components.homecall.views import AudioView, SpeakerTestView, UploadView


@pytest.fixture
def dlna(hass, devices, monkeypatch):
    speaker = {
        "entity_id": "media_player.jbl",
        "name": "JBL",
        "available": True,
        "transport": "dlna",
    }
    monkeypatch.setattr("custom_components.homecall.views.dlna_candidates", lambda h: [speaker])
    monkeypatch.setattr("custom_components.homecall.views.test_audio", lambda: b"mp3")
    monkeypatch.setattr(SpeakerTestView, "context", lambda self, r: None)
    monkeypatch.setattr(UploadView, "context", lambda self, r: None)
    return speaker


async def test_download_and_confirmation_required(hass, http_request, dlna):
    view = SpeakerTestView(hass)
    payload = {"entity_id": dlna["entity_id"], "action": "test"}
    response = await view.post(http_request(payload))
    token = json.loads(response.body)["receipt"]
    call = hass.services.async_call.call_args
    assert call.args[:2] == ("media_player", "play_media")
    assert call.args[2]["media_content_id"].startswith(
        "http://192.168.1.2:8123/api/homecall/audio/"
    )
    confirm = {**payload, "action": "confirm", "receipt": token}
    assert (await view.post(http_request(confirm))).status == 400
    request = http_request()
    request.method = "HEAD"
    await AudioView(hass).get(request, token)
    assert (await view.post(http_request(confirm))).status == 400
    await AudioView(hass).get(http_request(), token)
    assert (await view.post(http_request(confirm))).status == 200
    options = hass.config_entries.async_update_entry.call_args.kwargs["options"]
    assert options["tested_dlna"] == [dlna["entity_id"]]
    assert dlna["entity_id"] in options["default_targets"]
    assert token not in hass.data[DOMAIN]["clips"]


@pytest.mark.parametrize("mutation", ["expired", "wrong_speaker", "normal_clip"])
async def test_cannot_confirm_other_receipts(hass, http_request, dlna, mutation):
    clip = [time.monotonic() + 180, b"mp3", 1, dlna["entity_id"]]
    if mutation == "expired":
        clip[0] = 0
    if mutation == "wrong_speaker":
        clip[3] = "media_player.other"
    if mutation == "normal_clip":
        clip.pop()
    hass.data[DOMAIN]["clips"]["receipt"] = clip
    response = await SpeakerTestView(hass).post(
        http_request({"action": "confirm", "entity_id": dlna["entity_id"], "receipt": "receipt"})
    )
    assert response.status == 400
    hass.config_entries.async_update_entry.assert_not_called()


async def test_admin_only_and_failed_test_not_added(hass, http_request, dlna):
    with pytest.raises(web.HTTPForbidden):
        await SpeakerTestView(hass).post(http_request(admin=False))
    hass.services.async_call.side_effect = RuntimeError("device rejected")
    response = await SpeakerTestView(hass).post(
        http_request({"action": "test", "entity_id": dlna["entity_id"]})
    )
    assert response.status == 400
    assert not hass.data[DOMAIN]["clips"]
    hass.config_entries.async_update_entry.assert_not_called()


async def test_mixed_delivery(hass, entry, http_request, devices, dlna, wav_bytes):
    devices.append(dlna)
    entry.options = {"tested_dlna": [dlna["entity_id"]], "default_targets": [dlna["entity_id"]]}
    response = await UploadView(hass).post(
        http_request(targets=["notify.kitchen_speak", dlna["entity_id"]], body=wav_bytes())
    )
    assert response.status == 200
    calls = hass.services.async_call.call_args_list
    alexa = next(c for c in calls if c.args[0] == "notify")
    local = next(c for c in calls if c.args[0] == "media_player")
    assert "https://ha.example.com/api/homecall/audio/" in alexa.args[2]["message"]
    assert local.args[2]["media_content_id"].startswith("http://192.168.1.2:8123/")
    assert len(hass.data[DOMAIN]["clips"]) == 1


async def test_remove_revokes_visibility(hass, entry, http_request, dlna):
    entry.options = {"tested_dlna": [dlna["entity_id"]], "default_targets": [dlna["entity_id"]]}
    assert (
        await SpeakerTestView(hass).post(
            http_request({"action": "remove", "entity_id": dlna["entity_id"]})
        )
    ).status == 200
    options = hass.config_entries.async_update_entry.call_args.kwargs["options"]
    assert options["tested_dlna"] == options["default_targets"] == []


def test_platform_discovery_and_confirmation(hass, entry, monkeypatch):
    from types import SimpleNamespace

    from custom_components.homecall.helpers import allowed_targets, dlna_candidates, targets

    entities = {}
    states = {}
    for name, platform, features, disabled, state in [
        ("jbl", "dlna_dmr", 512, False, "idle"),
        ("other_brand", "dlna_dmr", 512, False, "off"),
        ("offline", "dlna_dmr", 0, False, "unavailable"),
        ("cast", "cast", 512, False, "idle"),
        ("sonos", "sonos", 512, False, "idle"),
        ("ma", "music_assistant", 512, False, "idle"),
        ("ma_disabled", "music_assistant", 512, True, "idle"),
        ("sonos_disabled", "sonos", 512, True, "idle"),
        ("sonos_unsupported", "sonos", 0, False, "idle"),
        ("unsupported", "dlna_dmr", 0, False, "idle"),
        ("disabled", "dlna_dmr", 512, True, "idle"),
    ]:
        eid = "media_player." + name
        entities[eid] = SimpleNamespace(
            entity_id=eid, domain="media_player", platform=platform, disabled_by=disabled
        )
        states[eid] = SimpleNamespace(
            name=name, state=state, attributes={"supported_features": features}
        )
    monkeypatch.setattr(
        "custom_components.homecall.helpers.er.async_get",
        lambda h: SimpleNamespace(entities=entities),
    )
    hass.states = SimpleNamespace(get=states.get)
    assert {t["name"] for t in dlna_candidates(hass)} == {
        "jbl",
        "other_brand",
        "offline",
        "sonos",
        "ma",
    }
    assert [t["name"] for t in targets(hass)] == ["ma", "sonos"]
    entry.options = {
        "tested_dlna": ["media_player.other_brand"],
        "default_targets": ["media_player.other_brand"],
    }
    assert [t["name"] for t in allowed_targets(hass, entry)] == ["other_brand"]
    entry.options["default_targets"] = []
    assert allowed_targets(hass, entry) == []


def test_local_address_resolution(hass, entry, monkeypatch):
    from homeassistant.helpers.network import NoURLAvailableError

    from custom_components.homecall.helpers import local_url

    monkeypatch.setattr(
        "custom_components.homecall.helpers.get_url", lambda h, **kw: "http://192.168.1.2:8123/"
    )
    assert local_url(hass, entry) == "http://192.168.1.2:8123"
    entry.options = {"local_url": "http://192.168.1.3:8123"}
    assert local_url(hass, entry) == "http://192.168.1.3:8123"
    entry.options = {}

    def fail(*args, **kwargs):
        raise NoURLAvailableError

    monkeypatch.setattr("custom_components.homecall.helpers.get_url", fail)
    assert local_url(hass, entry) == ""


def test_real_test_chime_is_mp3():
    from custom_components.homecall.audio import test_audio

    assert len(test_audio()) > 1000


@pytest.mark.parametrize(
    "payload",
    [
        None,
        [],
        {"action": "test"},
        {"action": "unknown", "entity_id": "media_player.jbl"},
        {"action": "confirm", "entity_id": "media_player.jbl", "receipt": []},
    ],
)
async def test_invalid_test_payload(hass, http_request, dlna, payload):
    with pytest.raises(web.HTTPBadRequest):
        await SpeakerTestView(hass).post(http_request(payload))


async def test_offline_busy_and_missing_address(hass, http_request, dlna, monkeypatch):
    payload = {"action": "test", "entity_id": dlna["entity_id"]}
    view = SpeakerTestView(hass)
    dlna["available"] = False
    assert (await view.post(http_request(payload))).status == 400
    dlna["available"] = True
    async with hass.data[DOMAIN]["lock"]:
        assert (await view.post(http_request(payload))).status == 409
    monkeypatch.setattr("custom_components.homecall.views.local_url", lambda h, e: "")
    assert (await view.post(http_request(payload))).status == 400
    hass.services.async_call.assert_not_awaited()


def test_local_address_prefers_existing_http_ip_listener(hass, entry):
    from types import SimpleNamespace

    from custom_components.homecall.helpers import local_url

    hass.config.api = SimpleNamespace(use_ssl=False, local_ip="192.168.1.5", port=8123)
    assert local_url(hass, entry) == "http://192.168.1.5:8123"


@pytest.mark.parametrize("transport", ["dlna", "sonos", "music_assistant"])
async def test_local_announcement_route(hass, entry, dlna, transport):
    from unittest.mock import Mock

    from custom_components.homecall.views import deliver

    dlna["transport"] = transport
    manager = Mock()
    hass.data[DOMAIN]["resume_manager"] = manager
    entry.options = {"resume_dlna": [dlna["entity_id"]]}
    assert (await deliver(hass, entry, dlna["entity_id"], "clip"))["accepted"]
    data = hass.services.async_call.call_args.args[2]
    if transport == "music_assistant":
        assert hass.services.async_call.call_args.args[:2] == (
            "music_assistant",
            "play_announcement",
        )
        assert data == {
            "entity_id": dlna["entity_id"],
            "url": "http://192.168.1.2:8123/api/homecall/audio/clip.mp3",
            "use_pre_announce": False,
        }
        manager.prepare.assert_not_called()
        manager.cancel.assert_called_once_with(dlna["entity_id"])
        return
    assert data["media_content_id"] == "http://192.168.1.2:8123/api/homecall/audio/clip.mp3"
    if transport == "sonos":
        assert data["announce"] is True
        manager.prepare.assert_not_called()
        manager.cancel.assert_called_once_with(dlna["entity_id"])
    else:
        assert "announce" not in data
        manager.prepare.assert_called_once()


@pytest.mark.parametrize("transport", ["sonos", "music_assistant"])
async def test_sonos_onboarding_uses_announcement(hass, http_request, dlna, transport):
    dlna["transport"] = transport
    response = await SpeakerTestView(hass).post(
        http_request({"action": "test", "entity_id": dlna["entity_id"]})
    )
    assert response.status == 200
    assert json.loads(response.body)["requires_confirmation"] is False
    hass.config_entries.async_update_entry.assert_not_called()
    if transport == "sonos":
        assert hass.services.async_call.call_args.args[2]["announce"] is True
    else:
        assert hass.services.async_call.call_args.args[:2] == (
            "music_assistant",
            "play_announcement",
        )


@pytest.mark.parametrize("platform", ["sonos", "music_assistant"])
def test_sonos_requires_confirmation_and_explicit_visibility(hass, entry, monkeypatch, platform):
    from types import SimpleNamespace

    from custom_components.homecall.helpers import allowed_targets

    entity = SimpleNamespace(
        entity_id="media_player.sonos", domain="media_player", platform=platform, disabled_by=None
    )
    monkeypatch.setattr(
        "custom_components.homecall.helpers.er.async_get",
        lambda h: SimpleNamespace(entities={entity.entity_id: entity}),
    )
    hass.states = SimpleNamespace(
        get=lambda eid: SimpleNamespace(
            name="Sonos", state="idle", attributes={"supported_features": 512}
        )
    )
    assert allowed_targets(hass, entry) == []
    entry.options = {"tested_dlna": [entity.entity_id]}
    assert allowed_targets(hass, entry) == []
    entry.options["default_targets"] = [entity.entity_id]
    assert allowed_targets(hass, entry)[0]["transport"] == platform


async def test_alexa_optional_sound_test(hass, http_request, devices, monkeypatch):
    monkeypatch.setattr("custom_components.homecall.views.test_audio", lambda: b"mp3")
    monkeypatch.setattr(SpeakerTestView, "context", lambda self, r: None)
    response = await SpeakerTestView(hass).post(
        http_request({"action": "test", "entity_id": "notify.kitchen_speak"})
    )
    assert response.status == 200
    assert json.loads(response.body)["requires_confirmation"] is False
    call = hass.services.async_call.call_args
    assert call.args[:2] == ("notify", "send_message")
    assert "https://ha.example.com/api/homecall/audio/" in call.args[2]["message"]
    hass.config_entries.async_update_entry.assert_not_called()


async def test_music_assistant_failure_does_not_fall_back(hass, entry, dlna):
    from custom_components.homecall.views import deliver

    dlna["transport"] = "music_assistant"
    hass.services.async_call.side_effect = RuntimeError("MA unavailable")
    assert not (await deliver(hass, entry, dlna["entity_id"], "clip"))["accepted"]
    hass.services.async_call.assert_awaited_once()
    assert hass.services.async_call.call_args.args[:2] == ("music_assistant", "play_announcement")
