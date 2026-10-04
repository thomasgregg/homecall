"""Exercise authenticated settings handlers against real aiohttp response types."""

import json

import pytest
from aiohttp import web

from custom_components.homecall.const import DOMAIN, valid_url
from custom_components.homecall.helpers import allowed_targets, settings, system_url
from custom_components.homecall.views import SettingsView, StatusView


@pytest.mark.parametrize(
    "url,valid",
    [
        ("https://ha.example.com", True),
        ("https://ha.example.com:8443", True),
        ("http://ha.example.com", False),
        ("https://user:secret@ha.example.com", False),
        ("https://ha.example.com/path", False),
        ("https://ha.example.com?x=y", False),
        ("https://ha.example.com#fragment", False),
        ("https://[", False),
        ("", False),
    ],
)
def test_url_validation(url, valid):
    assert valid_url(url) == valid


def test_allowlist_is_authoritative(hass, entry, devices):
    entry.options = {"use_all": False, "default_targets": ["notify.kitchen_speak"]}
    assert allowed_targets(hass, entry) == devices[:1]
    entry.options["default_targets"] = []
    assert allowed_targets(hass, entry) == []
    entry.options["use_all"] = True
    assert allowed_targets(hass, entry) == devices


def test_options_override_data(hass, entry):
    entry.options = {"public_url": "https://other.example.com"}
    assert settings(entry, hass)["public_url"] == "https://other.example.com"


def test_system_url_prefers_cloud(hass):
    from types import SimpleNamespace

    hass.data["cloud"] = SimpleNamespace(
        remote=SimpleNamespace(instance_domain="demo.ui.nabu.casa")
    )
    assert system_url(hass) == "https://demo.ui.nabu.casa"


@pytest.mark.parametrize("method", ["get", "post"])
async def test_only_admin_can_change_settings(hass, http_request, method):
    with pytest.raises(web.HTTPForbidden):
        await getattr(SettingsView(hass), method)(http_request(admin=False))


@pytest.mark.parametrize(
    "payload",
    [
        [],
        None,
        {"page": "missing"},
        {"page": "devices", "use_all": "true"},
        {"page": "devices", "use_all": True, "default_targets": [7]},
    ],
)
async def test_invalid_settings_payload(hass, http_request, devices, payload):
    with pytest.raises(web.HTTPBadRequest):
        await SettingsView(hass).post(http_request(payload))


@pytest.mark.parametrize("selected", [[], ["notify.unlisted_speak"]])
async def test_rejects_invalid_whitelist(hass, http_request, devices, selected):
    response = await SettingsView(hass).post(
        http_request({"page": "devices", "use_all": False, "default_targets": selected})
    )
    assert response.status == 400
    hass.config_entries.async_update_entry.assert_not_called()


async def test_custom_selection_survives_all_mode(hass, http_request, devices):
    r = await SettingsView(hass).post(
        http_request(
            {
                "page": "devices",
                "use_all": True,
                "default_targets": ["notify.kitchen_speak", "notify.kitchen_speak"],
            }
        )
    )
    assert r.status == 200
    options = hass.config_entries.async_update_entry.call_args.kwargs["options"]
    assert options["default_targets"] == ["notify.kitchen_speak"]


async def test_connection_update_normalizes_url(hass, http_request, devices):
    response = await SettingsView(hass).post(
        http_request(
            {
                "page": "connection",
                "public_url": " https://other.example.com/ ",
                "use_system_url": False,
            }
        )
    )
    assert response.status == 200
    assert json.loads(response.body)["public_url"] == "https://other.example.com"


async def test_status_limits_devices_and_reports_receipt(hass, entry, http_request, devices):
    entry.options = {"use_all": False, "default_targets": ["notify.kitchen_speak"]}
    req = http_request()
    req.query["receipt"] = "known"
    hass.data[DOMAIN]["clips"]["known"] = [999, b"audio", 2]
    response = await StatusView(hass).get(req)
    payload = json.loads(response.body)
    assert payload["targets"] == devices[:1]
    assert payload["audio_fetches"] == 2


def test_discovery_excludes_other_platforms_disabled_and_missing_entities(hass, monkeypatch):
    from types import SimpleNamespace

    from custom_components.homecall.helpers import targets

    def entity(identifier, platform="alexa_devices", domain="notify", disabled=False):
        return SimpleNamespace(
            entity_id=identifier, platform=platform, domain=domain, disabled_by=disabled
        )

    entities = [
        entity("notify.z_speak"),
        entity("notify.a_speak"),
        entity("notify.other_speak", platform="other"),
        entity("sensor.temperature", domain="sensor"),
        entity("notify.alexa_announce"),
        entity("notify.disabled_speak", disabled=True),
        entity("notify.missing_speak"),
    ]
    monkeypatch.setattr(
        "custom_components.homecall.helpers.er.async_get",
        lambda h: SimpleNamespace(entities={i: e for i, e in enumerate(entities)}),
    )
    states = {
        "notify.z_speak": SimpleNamespace(name="Zebra Speak", state="unavailable"),
        "notify.a_speak": SimpleNamespace(name="Attic Speak", state="unknown"),
    }
    hass.states = SimpleNamespace(get=states.get)
    assert targets(hass) == [
        {"entity_id": "notify.a_speak", "name": "Attic", "available": True},
        {"entity_id": "notify.z_speak", "name": "Zebra", "available": False},
    ]
