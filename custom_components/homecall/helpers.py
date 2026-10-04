"""Device discovery and integration settings."""

from homeassistant.helpers import entity_registry as er


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
    }


def allowed_targets(hass, entry):
    values = settings(entry)
    devices = targets(hass)
    if values["use_all"]:
        return devices
    allowed = set(values["default_targets"])
    return [device for device in devices if device["entity_id"] in allowed]
