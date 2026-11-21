"""Regression coverage for optional per-route volume and quiet failure behavior."""

import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from aiohttp import web
from homeassistant.components.media_player.const import MediaPlayerEntityFeature as Feature

from custom_components.homecall.announcement_volume import supports_announcement_volume
from custom_components.homecall.views import (
    AudioView,
    SettingsView,
    SpeakerTestView,
    StatusView,
    UploadView,
    deliver,
)

SONOS = "media_player.sonos"
MA = "media_player.mass"
CAST = "media_player.cast"


@pytest.fixture
def speakers(hass, entry, monkeypatch):
    sonos = SimpleNamespace(
        available=True,
        version="17.1",
        websocket=SimpleNamespace(
            play_clip=AsyncMock(return_value=({"success": True}, {"id": "clip-id"}))
        ),
        last_announce_id=None,
    )
    ma = SimpleNamespace(
        available=True,
        type="player",
        group_members=[],
        synced_to=None,
        active_group=None,
    )
    runtime = {
        "sonos": SimpleNamespace(discovered={"sonos-device": sonos}),
        "music_assistant": SimpleNamespace(mass=SimpleNamespace(players={"ma-device": ma})),
    }
    entities = {
        SONOS: SimpleNamespace(
            entity_id=SONOS,
            id="sonos-key",
            platform="sonos",
            config_entry_id="sonos",
            unique_id="sonos-device",
        ),
        MA: SimpleNamespace(
            entity_id=MA,
            id="ma-key",
            platform="music_assistant",
            config_entry_id="music_assistant",
            unique_id="ma-device",
        ),
        CAST: SimpleNamespace(entity_id=CAST, id="cast-key", platform="cast"),
    }
    registry = SimpleNamespace(async_get=entities.get)
    hass.config_entries.async_get_entry = lambda key: SimpleNamespace(
        domain=key, runtime_data=runtime[key]
    )
    state = SimpleNamespace(
        state="idle",
        attributes={"supported_features": int(Feature.MEDIA_ANNOUNCE | Feature.VOLUME_SET)},
    )

    def candidates(_):
        return [
            {
                "entity_id": key,
                "name": key.split(".")[1],
                "transport": entity.platform,
                "available": True,
                "announcement_volume_supported": supports_announcement_volume(hass, entity, state),
            }
            for key, entity in entities.items()
        ]

    monkeypatch.setattr(
        "custom_components.homecall.announcement_volume.er.async_get", lambda _: registry
    )
    monkeypatch.setattr("custom_components.homecall.views.dlna_candidates", candidates)
    monkeypatch.setattr("custom_components.homecall.views.targets", candidates)
    monkeypatch.setattr(
        "custom_components.homecall.views.allowed_targets", lambda *_: candidates(hass)
    )
    monkeypatch.setattr(
        "custom_components.homecall.views.local_url", lambda *_: "http://ha.local:8123"
    )
    monkeypatch.setattr("custom_components.homecall.views.convert_wav", lambda *_: b"mp3")
    monkeypatch.setattr("custom_components.homecall.views.test_audio", lambda: b"test")
    monkeypatch.setattr(UploadView, "context", lambda *_: None)
    monkeypatch.setattr(SpeakerTestView, "context", lambda *_: None)
    entry.options = {"added_speakers": [SONOS, MA, CAST], "default_targets": [SONOS, MA, CAST]}
    return SimpleNamespace(
        sonos=sonos, ma=ma, entities=entities, state=state, candidates=candidates
    )


def option(enabled=True, level=25):
    return {"enabled": enabled, "level": level}


def save_settings(http_request, changes, added=(SONOS, MA, CAST), admin=True):
    return http_request(
        {
            "page": "devices",
            "use_all": False,
            "default_targets": [],
            "added_speakers": list(added),
            "announcement_volume_changes": changes,
        },
        admin=admin,
    )


async def test_rename_visibility_removal_and_admin_boundary(
    hass,
    entry,
    http_request,
    speakers,
):
    view = SettingsView(hass)
    with pytest.raises(web.HTTPForbidden):
        await view.post(save_settings(http_request, {SONOS: option()}, admin=False))
    with pytest.raises(web.HTTPBadRequest):
        await view.post(save_settings(http_request, {SONOS: option(level=True)}))
    assert (await view.post(save_settings(http_request, {CAST: option()}))).status == 400
    hass.config_entries.async_update_entry.assert_not_called()

    response = await view.post(save_settings(http_request, {SONOS: option(), MA: option(level=33)}))
    assert response.status == 200
    entry.options = hass.config_entries.async_update_entry.call_args.kwargs["options"]
    assert entry.options["default_targets"] == []
    assert entry.options["announcement_volumes"] == {
        "sonos-key": option(),
        "ma-key": option(level=33),
    }

    renamed = "media_player.bedroom"
    entity = speakers.entities.pop(SONOS)
    entity.entity_id = renamed
    speakers.entities[renamed] = entity
    data = json.loads((await view.get(http_request())).body)
    assert data["announcement_volumes"][renamed] == option()
    response = await view.post(save_settings(http_request, {}, (renamed, MA, CAST)))
    assert response.status == 200
    entry.options = hass.config_entries.async_update_entry.call_args.kwargs["options"]
    assert "sonos-key" in entry.options["announcement_volumes"]
    response = await view.post(save_settings(http_request, {}, (MA, CAST)))
    assert response.status == 200
    assert hass.config_entries.async_update_entry.call_args.kwargs["options"][
        "announcement_volumes"
    ] == {"ma-key": option(level=33)}


async def test_mixed_delivery_and_disabled_override(hass, entry, http_request, wav_bytes, speakers):
    entry.options["announcement_volumes"] = {
        "sonos-key": option(level=22),
        "ma-key": option(enabled=False, level=99),
    }
    response = await UploadView(hass).post(
        http_request(targets=[SONOS, MA, CAST], body=wav_bytes())
    )
    assert all(result["accepted"] for result in json.loads(response.body)["results"])
    assert speakers.sonos.websocket.play_clip.call_args.kwargs == {"volume": 22}
    assert speakers.sonos.last_announce_id == "clip-id"
    calls = {
        call.args[2]["entity_id"]: call.args for call in hass.services.async_call.call_args_list
    }
    assert set(calls) == {MA, CAST}
    assert "announce_volume" not in calls[MA][2]
    assert "extra" not in calls[CAST][2]
    assert len(hass.data["homecall"]["clips"]) == 1
    await deliver(hass, entry, MA, "clip", announcement_volume=38)
    assert hass.services.async_call.call_args.args[2]["announce_volume"] == 38
    assert hass.services.async_call.call_args.args[2]["use_pre_announce"] is False


@pytest.mark.parametrize(
    "grouping",
    [
        {"type": "group"},
        {"group_members": ["child"]},
        {"synced_to": "leader"},
        {"active_group": "group"},
        {"static_group_members": ["child"]},
    ],
)
async def test_music_assistant_rechecks_grouping_at_delivery(hass, entry, speakers, grouping):
    for field, value in grouping.items():
        setattr(speakers.ma, field, value)
    result = await deliver(hass, entry, MA, "clip", announcement_volume=25)
    assert result["reason"] == "announcement_volume_unavailable"
    hass.services.async_call.assert_not_called()


async def test_sonos_s1_and_native_clip_rejection_never_fall_back(hass, entry, speakers):
    speakers.sonos.version = "11.16.1"
    result = await deliver(hass, entry, SONOS, "clip", announcement_volume=25)
    assert result["reason"] == "announcement_volume_unavailable"
    speakers.sonos.websocket.play_clip.assert_not_called()
    speakers.sonos.version = "17.1"
    speakers.sonos.websocket.play_clip.return_value = ({"success": False}, None)
    result = await deliver(hass, entry, SONOS, "clip", announcement_volume=25)
    assert result["reason"] == "announcement_volume_unavailable"
    hass.services.async_call.assert_not_called()


async def test_audio_clip_timeout_is_unconfirmed_and_peer_is_delivered(
    hass,
    entry,
    http_request,
    wav_bytes,
    speakers,
    monkeypatch,
):
    monkeypatch.setattr("custom_components.homecall.views.DELIVERY_TIMEOUT", 0.02)
    entry.options["announcement_volumes"] = {"ma-key": option(level=25)}

    async def dispatch(_, __, payload, **kwargs):
        if payload["entity_id"] == MA:
            await asyncio.Event().wait()

    hass.services.async_call.side_effect = dispatch
    response = await UploadView(hass).post(
        http_request(targets=[MA, CAST], body=wav_bytes(seconds=35))
    )
    assert json.loads(response.body)["results"] == [
        {"entity_id": MA, "accepted": False, "reason": "delivery_unconfirmed"},
        {"entity_id": CAST, "accepted": True},
    ]
    assert not hass.data["homecall"]["lock"].locked()


async def test_speaker_sound_test_uses_draft_without_saving(hass, http_request, speakers):
    response = await SpeakerTestView(hass).post(
        http_request(
            {
                "action": "test",
                "entity_id": SONOS,
                "announcement_volume": option(level=27),
            }
        )
    )
    assert response.status == 200
    assert json.loads(response.body)["diagnostics"]["requested_announcement_volume_percent"] == 27
    assert speakers.sonos.websocket.play_clip.call_args.kwargs == {"volume": 27}
    hass.config_entries.async_update_entry.assert_not_called()


async def test_unconfirmed_music_assistant_test_keeps_owner_scoped_diagnostics(
    hass, http_request, speakers, monkeypatch
):
    monkeypatch.setattr("custom_components.homecall.views.DELIVERY_TIMEOUT", 0.02)

    async def wait_for_player(*args, **kwargs):
        await asyncio.Event().wait()

    hass.services.async_call.side_effect = wait_for_player
    request = http_request({"action": "test", "entity_id": MA, "announcement_volume": option()})
    request["hass_user"].id = "test-admin"
    response = await SpeakerTestView(hass).post(request)

    assert response.status == 400
    result = json.loads(response.body)
    diagnostics = result["diagnostics"]
    assert result["error"] == diagnostics["error"] == "delivery_unconfirmed"
    assert diagnostics["failure_stage"] == "delivery"
    assert diagnostics["requested_announcement_volume_percent"] == 25
    assert diagnostics["audio_fetches"] == 0
    assert "receipt" not in result

    token = next(iter(hass.data["homecall"]["clips"]))
    assert token not in response.text
    await AudioView(hass).get(http_request(), token)
    status_request = http_request()
    status_request.query["diagnostic_id"] = diagnostics["diagnostic_id"]
    with pytest.raises(web.HTTPNotFound):
        await StatusView(hass).get(status_request)
    status_request["hass_user"].id = "test-admin"
    refreshed = json.loads((await StatusView(hass).get(status_request)).body)["diagnostics"]
    assert refreshed["audio_fetches"] == 1
    assert refreshed["error"] == "delivery_unconfirmed"
    assert token not in json.dumps(refreshed)


@pytest.mark.parametrize("draft", [option(level=12), option(level=34), option(False, 34), None])
async def test_music_assistant_sound_test_sends_selected_volume(
    hass, entry, http_request, speakers, draft
):
    entry.options["announcement_volumes"] = {"ma-key": option(level=23)}
    preference = {"announcement_volume": draft} if draft else {}
    response = await SpeakerTestView(hass).post(
        http_request({"action": "test", "entity_id": MA, **preference})
    )
    assert response.status == 200
    domain, service, data = hass.services.async_call.call_args.args
    assert (domain, service) == ("music_assistant", "play_announcement")
    assert data["use_pre_announce"] is False
    expected = 23 if draft is None else draft["level"] if draft["enabled"] else None
    assert data.get("announce_volume") == expected
    assert (
        json.loads(response.body)["diagnostics"].get("requested_announcement_volume_percent")
        == expected
    )
    hass.config_entries.async_update_entry.assert_not_called()
