"""Restoration completion, ownership, overlapping sends and lifecycle cleanup."""

import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from aiohttp import web
from homeassistant.components.media_player.const import MediaPlayerEntityFeature as Feature

from custom_components.homecall.const import DOMAIN
from custom_components.homecall.resume import ResumeManager, snapshot
from custom_components.homecall.views import SpeakerTestView

ENTITY = "media_player.jbl"
ANNOUNCEMENT = "http://ha/api/homecall/audio/token.mp3"
MUSIC = "http://music/track.mp3"


def state(phase="playing", url=MUSIC, features=Feature.PLAY_MEDIA | Feature.SEEK | Feature.PAUSE):
    return SimpleNamespace(
        state=phase,
        attributes={
            "media_content_id": url,
            "media_content_type": "music",
            "media_position": 12,
            "media_duration": 300,
            "supported_features": features,
        },
        context=SimpleNamespace(user_id=None),
    )


@pytest.fixture
def manager(hass, entry, monkeypatch):
    entry.options = {"resume_dlna": [ENTITY], "tested_dlna": [ENTITY]}
    current = [state()]
    hass.states = SimpleNamespace(get=lambda entity: current[0])
    listeners = []

    def track(hass, entity, fn):
        listeners.append(fn)
        return lambda: listeners.remove(fn)

    monkeypatch.setattr("custom_components.homecall.resume.async_track_state_change_event", track)
    manager = ResumeManager(hass)

    def update(value):
        current[0] = value
        for fn in list(listeners):
            fn(SimpleNamespace(data={"new_state": value}))

    async def call(domain, service, data, **kw):
        if service == "play_media":
            update(state(url=data["media_content_id"]))

    hass.services.async_call.side_effect = call
    return manager, update, listeners


async def finish(manager, update):
    update(state(url=ANNOUNCEMENT))
    manager.pending[ENTITY]["started_at"] -= 5
    update(state("idle", ANNOUNCEMENT))
    await asyncio.gather(*manager.tasks)


async def test_finish_restores_track_and_position(hass, manager):
    m, update, listeners = manager
    m.prepare(ENTITY, ANNOUNCEMENT, 3)
    await finish(m, update)
    calls = hass.services.async_call.call_args_list
    assert calls[0].args[2]["media_content_id"] == MUSIC
    assert calls[1].args[1] == "media_seek"
    assert calls[1].args[2]["seek_position"] == 12
    assert not m.pending and not listeners


async def test_paused_media_returns_to_paused(hass, manager):
    m, update, _ = manager
    update(state("paused"))
    m.prepare(ENTITY, ANNOUNCEMENT, 3)
    await finish(m, update)
    assert [c.args[1] for c in hass.services.async_call.call_args_list] == [
        "play_media",
        "media_seek",
        "media_pause",
    ]


@pytest.mark.parametrize(
    "replacement",
    [
        state(url="http://music/new.mp3"),
        state("unavailable", ANNOUNCEMENT),
        state("paused", ANNOUNCEMENT),
        state("idle", ANNOUNCEMENT),
    ],
)
async def test_user_change_offline_pause_or_early_stop_cancels(hass, manager, replacement):
    m, update, listeners = manager
    m.prepare(ENTITY, ANNOUNCEMENT, 3)
    update(state(url=ANNOUNCEMENT))
    update(replacement)
    await asyncio.sleep(0)
    assert not m.pending and not listeners
    hass.services.async_call.assert_not_awaited()


async def test_overlap_keeps_original_track(hass, manager):
    m, update, _ = manager
    m.prepare(ENTITY, ANNOUNCEMENT, 3)
    update(state(url=ANNOUNCEMENT))
    second = ANNOUNCEMENT.replace("token", "second")
    m.prepare(ENTITY, second, 3)
    assert m.pending[ENTITY]["saved"]["content"] == MUSIC
    update(state(url=second))
    m.pending[ENTITY]["started_at"] -= 5
    update(state("idle", second))
    await asyncio.gather(*m.tasks)
    assert hass.services.async_call.call_args_list[0].args[2]["media_content_id"] == MUSIC


async def test_setting_off_before_completion_prevents_restore(hass, entry, manager):
    m, update, _ = manager
    m.prepare(ENTITY, ANNOUNCEMENT, 3)
    entry.options["resume_dlna"] = []
    await finish(m, update)
    hass.services.async_call.assert_not_awaited()


async def test_no_seek_capability_restarts_track(hass, manager):
    m, update, _ = manager
    update(state(features=Feature.PLAY_MEDIA))
    m.prepare(ENTITY, ANNOUNCEMENT, 3)
    await finish(m, update)
    assert [c.args[1] for c in hass.services.async_call.call_args_list] == ["play_media"]


async def test_user_changes_track_while_restore_loads(hass, manager):
    m, update, _ = manager

    async def changed_by_user(*args, **kwargs):
        update(state(url="http://music/new.mp3"))

    hass.services.async_call.side_effect = changed_by_user
    m.prepare(ENTITY, ANNOUNCEMENT, 3)
    await finish(m, update)
    assert hass.services.async_call.await_count == 1


def test_position_elapsed_and_nonresumable_states():
    value = state()
    value.attributes["media_position_updated_at"] = datetime.now(UTC) - timedelta(seconds=5)
    assert 17 <= snapshot(value)["position"] < 18
    assert snapshot(state("idle")) is None
    assert snapshot(state(url=ANNOUNCEMENT)) is None
    assert snapshot(state("paused", features=Feature.PLAY_MEDIA)) is None
    value.attributes["media_position"] = None
    assert snapshot(value)["position"] is None


async def test_unload_releases_listener_and_timeout(manager):
    m, _, listeners = manager
    m.prepare(ENTITY, ANNOUNCEMENT, 3)
    timer = m.pending[ENTITY]["timeout"]
    m.close()
    assert not listeners and timer.cancelled()


async def test_resume_option_only_for_tested_speakers(hass, entry, http_request, devices):
    view = SpeakerTestView(hass)
    with pytest.raises(web.HTTPBadRequest):
        await view.post(http_request({"action": "resume", "entity_id": ENTITY, "enabled": True}))
    entry.options = {"tested_dlna": [ENTITY]}
    assert (
        await view.post(http_request({"action": "resume", "entity_id": ENTITY, "enabled": True}))
    ).status == 200
    assert hass.config_entries.async_update_entry.call_args.kwargs["options"]["resume_dlna"] == [
        ENTITY
    ]


async def test_new_announcement_during_restore_preserves_snapshot(hass, manager):
    m, update, _ = manager
    blocked = asyncio.Event()

    async def delayed(*args, **kwargs):
        await blocked.wait()

    hass.services.async_call.side_effect = delayed
    m.prepare(ENTITY, ANNOUNCEMENT, 3)
    update(state(url=ANNOUNCEMENT))
    m.pending[ENTITY]["started_at"] -= 5
    update(state("idle", ANNOUNCEMENT))
    await asyncio.sleep(0)
    first_task = next(iter(m.tasks))
    m.prepare(ENTITY, ANNOUNCEMENT.replace("token", "next"), 3)
    assert m.pending[ENTITY]["saved"]["position"] == 12
    await asyncio.gather(first_task, return_exceptions=True)
    assert first_task.cancelled()
    m.close()


async def test_delivery_arms_resume_before_playback(hass, entry, devices, monkeypatch):
    from unittest.mock import Mock

    from custom_components.homecall.views import deliver

    monkeypatch.setattr(
        "custom_components.homecall.views.dlna_candidates",
        lambda h: [{"entity_id": ENTITY, "transport": "dlna"}],
    )
    resume = Mock()
    hass.data[DOMAIN]["resume_manager"] = resume
    entry.options = {"resume_dlna": [ENTITY]}
    result = await deliver(hass, entry, ENTITY, "token", duration=7)
    assert result["accepted"]
    assert resume.prepare.call_args.args[2] == 7
    entry.options["resume_dlna"] = []
    await deliver(hass, entry, ENTITY, "token")
    resume.cancel.assert_called_with(ENTITY)
    hass.services.async_call.side_effect = RuntimeError("playback failed")
    assert not (await deliver(hass, entry, ENTITY, "token"))["accepted"]
    resume.cancel.assert_called_with(ENTITY)


async def test_restore_failure_is_contained(hass, manager, caplog):
    m, update, listeners = manager
    hass.services.async_call.side_effect = RuntimeError("unavailable")
    m.prepare(ENTITY, ANNOUNCEMENT, 3)
    await finish(m, update)
    assert "Could not restore playback" in caplog.text
    assert not listeners
