"""Check and store per-route announcement volume without changing player volume."""

import re

from homeassistant.components.media_player.const import MediaPlayerEntityFeature as Feature
from homeassistant.helpers import entity_registry as er


def valid_preference(value):
    """Accept a switch state and a percentage common to both integrations."""
    return (
        isinstance(value, dict)
        and value.keys() == {"enabled", "level"}
        and type(value["enabled"]) is bool
        and type(value["level"]) is int
        and 1 <= value["level"] <= 100
    )


def _integration_data(hass, entity):
    if entry_id := getattr(entity, "config_entry_id", None):
        entry = hass.config_entries.async_get_entry(entry_id)
        if entry is not None and entry.domain == entity.platform:
            return getattr(entry, "runtime_data", None)
    return None


def sonos_audio_clip_player(hass, entity):
    """Return HA's connected Sonos speaker when it reports S2 software."""
    discovered = getattr(_integration_data(hass, entity), "discovered", None)
    speaker = discovered.get(entity.unique_id) if discovered else None
    version = getattr(speaker, "version", None)
    major = re.match(r"^([0-9]+)\.", version) if isinstance(version, str) else None
    # S1 remains on the 11.x series. Sonos documents AudioClip on S2.
    if major and int(major[1]) >= 12 and speaker.available and speaker.websocket:
        return speaker
    return None


def supports_announcement_volume(hass, entity, state):
    """Only allow positively identified routes and standalone MA players."""
    if state.state in ("unknown", "unavailable"):
        return False
    features = int(state.attributes.get("supported_features", 0))
    if not features & Feature.MEDIA_ANNOUNCE:
        return False
    if entity.platform == "sonos":
        return sonos_audio_clip_player(hass, entity) is not None
    if entity.platform != "music_assistant" or not features & Feature.VOLUME_SET:
        return False
    mass = getattr(_integration_data(hass, entity), "mass", None)
    if mass is None:
        return False
    player = mass.players.get(entity.unique_id)
    return (
        player is not None
        and player.type == "player"
        and player.available
        and not (
            player.group_members
            or player.synced_to
            or player.active_group
            or getattr(player, "static_group_members", None)
        )
    )


def preference_key(hass, entity_id):
    """Use the registry identity so a rename does not lose the preference."""
    entity = er.async_get(hass).async_get(entity_id)
    return entity.id if entity and entity.platform in ("sonos", "music_assistant") else None


def requested_level(hass, preferences, entity_id):
    """An inactive preference leaves the integration's own default in control."""
    if preferences and (value := preferences.get(preference_key(hass, entity_id))):
        if valid_preference(value) and value["enabled"]:
            return value["level"]
    return None
