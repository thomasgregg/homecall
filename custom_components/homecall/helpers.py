"""Device discovery and integration settings."""

from ipaddress import ip_address

from homeassistant.components.media_player.const import MediaPlayerEntityFeature
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
    result.extend(t for t in dlna_candidates(hass) if t["entity_id"] in confirmed)
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
        "tested_dlna": values.get("tested_dlna", []),
        "resume_dlna": values.get("resume_dlna", []),
        "local_url": values.get("local_url", ""),
    }


def allowed_targets(hass, entry):
    values = settings(entry)
    devices = targets(hass)
    allowed = set(values["default_targets"])
    return [
        device
        for device in devices
        if device["entity_id"] in allowed
        or (values["use_all"] and device.get("transport") != "dlna")
    ]


def dlna_candidates(hass):
    """Only registered DLNA renderers with URL playback; Cast is not a fallback."""
    result = []
    for entity in er.async_get(hass).entities.values():
        if entity.platform != "dlna_dmr" or entity.domain != "media_player" or entity.disabled_by:
            continue
        state = hass.states.get(entity.entity_id)
        if (
            state is None
            or not int(state.attributes.get("supported_features", 0))
            & MediaPlayerEntityFeature.PLAY_MEDIA
        ):
            continue
        result.append(
            {
                "entity_id": entity.entity_id,
                "name": state.name,
                "available": state.state not in ("unavailable", "unknown"),
                "transport": "dlna",
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
