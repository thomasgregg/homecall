"""Speaker labels use Home Assistant names and areas within the visible speaker list."""

import json
from types import SimpleNamespace
from unittest.mock import Mock

from custom_components.homecall import helpers
from custom_components.homecall.views import SettingsView, StatusView


async def test_speaker_labels_follow_registries_and_distinguish_collisions(
    hass, entry, http_request, monkeypatch
):
    speakers = {
        "media_player.kitchen": ("Sonos", None, "kitchen"),
        "media_player.window": ("Sonos", "living", "kitchen"),
        "media_player.door": ("Sonos", None, "living"),
        "media_player.desk": ("Sonos by the desk", None, "living"),
        "media_player.no_area_one": ("Sonos", None, None),
        "media_player.no_area_two": ("Sonos", None, None),
        "notify.echo_speak": ("Echo Speak", None, "kitchen"),
    }
    entities, states, devices = {}, {}, {}
    for entity_id, (name, entity_area, device_area) in speakers.items():
        domain = entity_id.split(".")[0]
        entities[entity_id] = SimpleNamespace(
            entity_id=entity_id,
            domain=domain,
            platform="sonos" if domain == "media_player" else "alexa_devices",
            disabled_by=None,
            device_id=entity_id,
            area_id=entity_area,
        )
        devices[entity_id] = SimpleNamespace(area_id=device_area)
        states[entity_id] = SimpleNamespace(
            name=name, state="idle", attributes={"supported_features": 512}
        )
    # Simulate the 2026.11 name alongside an older friendly name still in state.
    entities["media_player.desk"].entity_name = ""
    states["media_player.desk"].name = "Sonos"
    monkeypatch.setattr(
        helpers.er, "async_get_full_entity_name", Mock(return_value="Sonos by the desk")
    )
    monkeypatch.setattr(helpers.er, "async_get", lambda h: SimpleNamespace(entities=entities))
    monkeypatch.setattr(helpers.dr, "async_get", lambda h: SimpleNamespace(async_get=devices.get))
    areas = {
        "kitchen": SimpleNamespace(name="Kitchen"),
        "living": SimpleNamespace(name="Living room"),
    }
    monkeypatch.setattr(
        helpers.ar, "async_get", lambda h: SimpleNamespace(async_get_area=areas.get)
    )
    hass.states = SimpleNamespace(get=states.get)
    entry.options = {"default_targets": list(speakers), "local_url": "http://ha.example.com"}

    status = json.loads((await StatusView(hass).get(http_request())).body)
    settings = json.loads((await SettingsView(hass).get(http_request())).body)
    by_id = {item["entity_id"]: item for item in status["targets"]}
    assert settings["targets"] == status["targets"]
    assert settings["dlna_candidates"] == [
        item for item in status["targets"] if item.get("transport") == "sonos"
    ]
    assert by_id["media_player.kitchen"]["area_name"] == "Kitchen"
    assert by_id["media_player.window"]["area_name"] == "Living room"
    assert by_id["media_player.door"]["area_name"] == "Living room"
    assert by_id["media_player.desk"]["name"] == "Sonos by the desk"
    assert by_id["notify.echo_speak"]["name"] == "Echo"
    assert by_id["notify.echo_speak"]["area_name"] == "Kitchen"
    assert "area_name" not in by_id["media_player.no_area_one"]
    assert {key for key, item in by_id.items() if item.get("show_entity_id")} == {
        "media_player.door",
        "media_player.window",
        "media_player.no_area_one",
        "media_player.no_area_two",
    }


async def test_hidden_speakers_do_not_affect_visible_labels(hass, devices, http_request):
    for target in devices:
        target.update(name="Echo", area_name="Kitchen")
    request = http_request(admin=False)
    request["hass_user"].permissions = SimpleNamespace(
        check_entity=lambda entity_id, policy: entity_id == devices[0]["entity_id"]
    )
    status = json.loads((await StatusView(hass).get(request)).body)
    assert status["targets"] == devices[:1]
