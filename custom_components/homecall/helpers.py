"""Device discovery and integration settings."""

from collections import Counter
from ipaddress import ip_address

from homeassistant.components.media_player.const import MediaPlayerEntityFeature
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.network import NoURLAvailableError, get_url
from yarl import URL

from . import voice_satellite
from .announcement_volume import supports_announcement_volume

# Routes added per speaker in their own settings page. DLNA additionally needs a
# confirmed sound test; the others are shown once added.
ADDED_TRANSPORTS = ("sonos", "music_assistant", "cast", "echomuse", voice_satellite.TRANSPORT)
LOCAL_TRANSPORTS = ("dlna", *ADDED_TRANSPORTS)


def _speaker_label(hass, entity, state, device):
    """Describe a speaker using the Home Assistant name and area registries."""
    name = state.name
    # HA 2026.11 and later can retain an old friendly name for compatibility.
    if hasattr(entity, "entity_name"):
        name = er.async_get_full_entity_name(hass, entity) or name
    if entity.domain == "notify":
        name = name.removesuffix(" Speak")

    label = {"name": name}
    area_id = entity.area_id
    if area_id is None and device is not None:
        area_id = dr.async_get_effective_area_id(hass, device)
    if area_id and (area := ar.async_get(hass).async_get_area(area_id)):
        label["area_name"] = area.name
    return label


def distinguish_speakers(speakers):
    """Show entity IDs when the visible name and area still collide."""
    labels = {
        speaker["entity_id"]: (
            speaker["name"].casefold(),
            speaker.get("area_name", "").casefold(),
        )
        for speaker in speakers
    }
    counts = Counter(labels.values())
    return [
        {**speaker, "show_entity_id": True} if counts[labels[speaker["entity_id"]]] > 1 else speaker
        for speaker in speakers
    ]


def targets(hass):
    registry = er.async_get(hass)
    result = []
    for entity in registry.entities.values():
        if (
            entity.platform != "alexa_devices"
            or entity.domain != "notify"
            or not entity.entity_id.endswith("_speak")
            or entity.disabled_by
        ):
            continue
        state = hass.states.get(entity.entity_id)
        if state is None:
            continue
        device = dr.async_get(hass).async_get(entity.device_id) if entity.device_id else None
        result.append(
            {
                "entity_id": entity.entity_id,
                **_speaker_label(hass, entity, state, device),
                "available": state.state != "unavailable",
            }
        )
    entry = hass.data.get("homecall", {}).get("entry")
    confirmed = settings(entry).get("tested_dlna", []) if entry else []
    result.extend(
        t
        for t in dlna_candidates(hass)
        if t.get("transport") in ADDED_TRANSPORTS or t["entity_id"] in confirmed
    )
    return sorted(result, key=lambda item: item["name"])


def system_url(hass):
    cloud = hass.data.get("cloud")
    domain = getattr(getattr(cloud, "remote", None), "instance_domain", None)
    candidates = [f"https://{domain}" if domain else "", hass.config.external_url or ""]
    from .const import valid_url

    return next((url.rstrip("/") for url in candidates if valid_url(url.rstrip("/"))), "")


def settings(entry, hass=None):
    values = {**entry.data, **entry.options}
    automatic = values.get(
        "use_system_url",
        bool(hass and values.get("public_url", "").rstrip("/") == system_url(hass)),
    )
    return {
        "public_url": system_url(hass) if automatic and hass else values.get("public_url", ""),
        "use_system_url": automatic,
        "use_all": values.get("use_all", not bool(values.get("default_targets"))),
        "default_targets": values.get("default_targets", []),
        "added_speakers": values.get("added_speakers"),
        "tested_dlna": values.get("tested_dlna", []),
        "resume_dlna": values.get("resume_dlna", []),
        "local_url": values.get("local_url", ""),
        "announcement_chime": values.get("announcement_chime", False),
        "skip_cast_chime": values.get("skip_cast_chime", True),
        "custom_chime": values.get("custom_chime"),
        "announcement_volumes": values.get("announcement_volumes", {}),
    }


def allowed_targets(hass, entry):
    values = settings(entry)
    devices = targets(hass)
    allowed = set(values["default_targets"])
    return [
        device
        for device in devices
        if device["entity_id"] in allowed
        or (values["use_all"] and device.get("transport") not in LOCAL_TRANSPORTS)
    ]


def dlna_candidates(hass):
    """Discover supported local players; retain the legacy API name."""
    result = []
    for entity in er.async_get(hass).entities.values():
        echomuse = False
        device = None
        if entity.platform == "esphome" and entity.domain == "media_player":
            device = dr.async_get(hass).async_get(entity.device_id) if entity.device_id else None
            echomuse = bool(device and (device.manufacturer or "").casefold() == "echomuse")
        if (
            (
                entity.platform not in ("dlna_dmr", "sonos", "music_assistant", "cast")
                and not echomuse
            )
            or entity.domain != "media_player"
            or entity.disabled_by
        ):
            continue
        state = hass.states.get(entity.entity_id)
        if state is None or (
            state.state not in ("unavailable", "unknown")
            and not int(state.attributes.get("supported_features", 0))
            & MediaPlayerEntityFeature.PLAY_MEDIA
        ):
            continue
        if (
            echomuse
            and state.state not in ("unavailable", "unknown")
            and not int(state.attributes.get("supported_features", 0))
            & MediaPlayerEntityFeature.MEDIA_ANNOUNCE
        ):
            continue
        if not echomuse and entity.device_id:
            device = dr.async_get(hass).async_get(entity.device_id)
        result.append(
            {
                "entity_id": entity.entity_id,
                **_speaker_label(hass, entity, state, device),
                **(
                    {"announcement_volume_supported": True}
                    if entity.platform in ("sonos", "music_assistant")
                    and supports_announcement_volume(hass, entity, state)
                    else {}
                ),
                "available": state.state not in ("unavailable", "unknown"),
                "transport": (
                    "echomuse"
                    if echomuse
                    else "dlna"
                    if entity.platform == "dlna_dmr"
                    else entity.platform
                ),
            }
        )
    result.extend(voice_satellite_candidates(hass))
    return sorted(result, key=lambda item: item["name"])


def voice_satellite_candidates(hass):
    """Discover Voice Satellite kiosks through their Assist satellite entities.

    The satellite names the kiosk and reports whether its browser is connected.
    Delivery uses the media player on the same device, given as ``player``.
    Offline kiosks are listed but cannot be selected in the card.
    """
    entities = er.async_get(hass).entities.values()
    players = {
        entity.device_id: entity.entity_id
        for entity in entities
        if entity.platform == voice_satellite.PLATFORM
        and entity.domain == "media_player"
        and entity.device_id
        and not entity.disabled_by
    }
    result = []
    for entity in entities:
        if (
            entity.platform != voice_satellite.PLATFORM
            or entity.domain != "assist_satellite"
            or entity.disabled_by
            or not (player := players.get(entity.device_id))
        ):
            continue
        state = hass.states.get(entity.entity_id)
        player_state = hass.states.get(player)
        if state is None or player_state is None:
            continue
        available = state.state not in ("unavailable", "unknown") and player_state.state not in (
            "unavailable",
            "unknown",
        )
        if (
            available
            and not int(player_state.attributes.get("supported_features", 0))
            & MediaPlayerEntityFeature.PLAY_MEDIA
        ):
            continue
        device = dr.async_get(hass).async_get(entity.device_id)
        result.append(
            {
                "entity_id": entity.entity_id,
                **_speaker_label(hass, entity, state, device),
                "available": available,
                "transport": voice_satellite.TRANSPORT,
                "player": player,
            }
        )
    return result


def local_url(hass, entry):
    """Use HA's local address, never silently substitute Alexa's cloud URL."""
    configured = settings(entry).get("local_url", "")
    if configured:
        return configured
    api = getattr(hass.config, "api", None)
    if api and not api.use_ssl:
        address = ip_address(api.local_ip)
        if not address.is_loopback and not address.is_unspecified:
            return str(URL.build(scheme="http", host=api.local_ip, port=api.port))
    try:
        return get_url(hass, allow_external=False, allow_cloud=False, prefer_external=False).rstrip(
            "/"
        )
    except NoURLAvailableError:
        return ""
