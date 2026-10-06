"""Device discovery and integration settings."""

from ipaddress import ip_address

from homeassistant.components.media_player.const import MediaPlayerEntityFeature
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.network import NoURLAvailableError, get_url
from yarl import URL


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
        result.append(
            {
                "entity_id": entity.entity_id,
                "name": state.name.removesuffix(" Speak"),
                "available": state.state != "unavailable",
            }
        )
    entry = hass.data.get("homecall", {}).get("entry")
    confirmed = settings(entry).get("tested_dlna", []) if entry else []
    result.extend(
        t
        for t in dlna_candidates(hass)
        if t.get("transport") in ("sonos", "music_assistant", "cast", "echomuse")
        or t["entity_id"] in confirmed
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
    }


def allowed_targets(hass, entry):
    values = settings(entry)
    devices = targets(hass)
    allowed = set(values["default_targets"])
    return [
        device
        for device in devices
        if device["entity_id"] in allowed
        or (
            values["use_all"]
            and device.get("transport")
            not in ("dlna", "sonos", "music_assistant", "cast", "echomuse")
        )
    ]


def dlna_candidates(hass):
    """Discover supported local players; retain the legacy API name."""
    result = []
    for entity in er.async_get(hass).entities.values():
        echomuse = False
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
        result.append(
            {
                "entity_id": entity.entity_id,
                "name": state.name,
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
    return sorted(result, key=lambda item: item["name"])


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
