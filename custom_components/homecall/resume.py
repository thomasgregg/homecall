"""Restore interrupted DLNA playback without overriding a user's newer playback."""

import asyncio
import logging
import time
from datetime import UTC, datetime

from homeassistant.components.media_player.const import MediaPlayerEntityFeature as Feature
from homeassistant.core import callback
from homeassistant.helpers.event import async_track_state_change_event

_LOGGER = logging.getLogger(__name__)


def snapshot(state):
    """Capture resumable playback at its current position; never wake an idle player."""
    if not state or state.state not in ("playing", "paused"):
        return None
    attrs = state.attributes
    content = attrs.get("media_content_id")
    if not isinstance(content, str) or not content or "/api/homecall/audio/" in content:
        return None
    features = int(attrs.get("supported_features", 0))
    if state.state == "paused" and not features & Feature.PAUSE:
        return None
    position = attrs.get("media_position")
    if isinstance(position, (int, float)):
        updated = attrs.get("media_position_updated_at")
        if state.state == "playing" and isinstance(updated, datetime) and updated.tzinfo:
            position += max(0, (datetime.now(UTC) - updated).total_seconds())
        duration = attrs.get("media_duration")
        if isinstance(duration, (int, float)) and duration > 0:
            position = min(position, max(0, duration - 1))
        position = max(0, position)
    else:
        position = None
    return {
        "content": content,
        "type": attrs.get("media_content_type") or "music",
        "position": position,
        "paused": state.state == "paused",
        "features": features,
    }


class ResumeManager:
    """One bounded transaction per speaker, guarded by the announcement URL."""

    def __init__(self, hass):
        self.hass = hass
        self.pending = {}
        self.tasks = set()
        self.restoring = {}

    def cancel(self, entity_id):
        active = self.restoring.pop(entity_id, None)
        if active:
            active[1].cancel()
        transaction = self.pending.pop(entity_id, None)
        if transaction:
            transaction["unsubscribe"]()
            transaction["timeout"].cancel()
        return transaction or (active[0] if active else None)

    def close(self):
        for entity_id in list(self.pending):
            self.cancel(entity_id)
        for task in list(self.tasks):
            task.cancel()
        self.restoring.clear()

    def prepare(self, entity_id, url, duration, context=None):
        state = self.hass.states.get(entity_id)
        old = self.cancel(entity_id)
        saved = (
            old["saved"]
            if old
            and state
            and state.attributes.get("media_content_id") in (old["url"], old["saved"]["content"])
            else snapshot(state)
        )
        if saved is None:
            return
        transaction = {
            "saved": saved,
            "url": url,
            "started": False,
            "context": context,
            "previous_url": state.attributes.get("media_content_id"),
        }

        @callback
        def changed(event):
            if self.pending.get(entity_id) is not transaction:
                return
            current = event.data.get("new_state")
            if current is None or current.state in ("unknown", "unavailable", "off"):
                self.cancel(entity_id)
                return
            content = current.attributes.get("media_content_id")
            if content == url:
                if current.state == "playing":
                    if not transaction["started"]:
                        transaction["started_at"] = time.monotonic()
                    transaction["started"] = True
                elif current.state == "paused" and transaction["started"]:
                    self.cancel(entity_id)
                elif current.state == "idle" and transaction["started"]:
                    user_context = getattr(current, "context", None)
                    if time.monotonic() - transaction["started_at"] < max(0, duration - 1) or (
                        user_context
                        and user_context.user_id
                        and (not context or user_context.id != context.id)
                    ):
                        self.cancel(entity_id)
                        return
                    # The request was actually playing and has finished. A fixed
                    # recording-duration timer would cut off delayed playback.
                    self.cancel(entity_id)
                    task = asyncio.create_task(self.restore(entity_id, transaction))
                    self.tasks.add(task)
                    self.restoring[entity_id] = (transaction, task)

                    def finished(task):
                        self.tasks.discard(task)
                        if self.restoring.get(entity_id, (None, None))[1] is task:
                            self.restoring.pop(entity_id, None)

                    task.add_done_callback(finished)
            elif (
                content not in (saved["content"], transaction["previous_url"])
                or transaction["started"]
            ):
                # New media, pause/stop with cleared URL, or another app wins.
                self.cancel(entity_id)

        transaction["unsubscribe"] = async_track_state_change_event(self.hass, entity_id, changed)
        # Missing completion events never justify replacing another stream.
        transaction["timeout"] = asyncio.get_running_loop().call_later(
            min(180, duration + 45), self.cancel, entity_id
        )
        self.pending[entity_id] = transaction

    async def restore(self, entity_id, transaction):
        from .const import DOMAIN
        from .helpers import settings

        entry = self.hass.data.get(DOMAIN, {}).get("entry")
        if not entry or entity_id not in settings(entry)["resume_dlna"]:
            return
        current = self.hass.states.get(entity_id)
        if (
            not current
            or current.state != "idle"
            or current.attributes.get("media_content_id") != transaction["url"]
        ):
            return
        saved = transaction["saved"]
        loaded = asyncio.Event()
        abandoned = False

        @callback
        def changed(event):
            nonlocal abandoned
            state = event.data.get("new_state")
            if not state or state.state in ("off", "unavailable", "unknown"):
                abandoned = True
                loaded.set()
            elif (
                state.attributes.get("media_content_id") == saved["content"]
                and state.state == "playing"
            ):
                loaded.set()
            elif state.attributes.get("media_content_id") not in (
                transaction["url"],
                saved["content"],
            ):
                abandoned = True
                loaded.set()

        unsubscribe = async_track_state_change_event(self.hass, entity_id, changed)

        async def call(service, data=None):
            await self.hass.services.async_call(
                "media_player",
                service,
                {"entity_id": entity_id, **(data or {})},
                blocking=True,
                context=transaction["context"],
            )

        try:
            await call(
                "play_media",
                {"media_content_id": saved["content"], "media_content_type": saved["type"]},
            )
            current = self.hass.states.get(entity_id)
            if (
                current
                and current.state == "playing"
                and current.attributes.get("media_content_id") == saved["content"]
            ):
                loaded.set()
            await asyncio.wait_for(loaded.wait(), timeout=10)
            if abandoned:
                return
            # Re-check before seeking: never seek a newly selected user track.
            current = self.hass.states.get(entity_id)
            if (
                not current
                or current.attributes.get("media_content_id") != saved["content"]
                or entity_id in self.pending
            ):
                return
            if saved["position"] is not None and saved["features"] & Feature.SEEK:
                await call("media_seek", {"seek_position": saved["position"]})
            if saved["paused"]:
                current = self.hass.states.get(entity_id)
                if (
                    current
                    and current.attributes.get("media_content_id") == saved["content"]
                    and entity_id not in self.pending
                ):
                    await call("media_pause")
        except Exception:
            _LOGGER.warning("Could not restore playback on %s", entity_id)
        finally:
            unsubscribe()
