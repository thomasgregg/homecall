"""Exercise the real HA flow classes at input and result boundaries."""

from unittest.mock import AsyncMock, Mock

import pytest

from custom_components.homecall.config_flow import HomeCallConfigFlow


@pytest.fixture
def flow(hass, monkeypatch):
    flow = HomeCallConfigFlow()
    flow.hass = hass
    flow._values = {
        "public_url": "https://ha.example.com",
        "use_system_url": False,
        "use_all": True,
        "default_targets": [],
    }
    monkeypatch.setattr(flow, "async_show_form", Mock(side_effect=lambda **x: x))
    monkeypatch.setattr(flow, "async_show_menu", Mock(side_effect=lambda **x: x))
    monkeypatch.setattr(flow, "_create", AsyncMock(return_value={"type": "create_entry"}))
    return flow


async def test_connection_menu(flow):
    result = await flow.async_step_user()
    assert result["menu_options"] == ["system_address", "custom_address"]


async def test_invalid_custom_address_stays_in_form(flow):
    result = await flow.async_step_custom_address({"public_url": "http://ha.example.com"})
    assert result["errors"] == {"base": "invalid_url"}
    flow._create.assert_not_awaited()


async def test_valid_custom_address_continues_to_devices(flow):
    result = await flow.async_step_custom_address({"public_url": " https://other.example.com/ "})
    assert flow._values["public_url"] == "https://other.example.com"
    assert not flow._values["use_system_url"]
    assert result["step_id"] == "devices"


async def test_system_address_requires_available_https(flow, monkeypatch):
    monkeypatch.setattr("custom_components.homecall.config_flow.system_url", lambda h: "")
    result = await flow.async_step_system_address({})
    assert result["errors"]["base"] == "no_system_url"


async def test_all_devices_creates_entry(flow):
    await flow.async_step_all_devices()
    assert flow._values["use_all"]
    flow._create.assert_awaited_once()


async def test_custom_devices_reject_unknown(flow, monkeypatch):
    monkeypatch.setattr(
        "custom_components.homecall.config_flow.targets",
        lambda h: [{"entity_id": "notify.kitchen_speak", "name": "Kitchen"}],
    )
    result = await flow.async_step_custom_devices({"default_targets": ["notify.unknown_speak"]})
    assert result["errors"]["base"] == "select_echo"
    flow._create.assert_not_awaited()


async def test_custom_devices_updates_scope(flow, monkeypatch):
    monkeypatch.setattr(
        "custom_components.homecall.config_flow.targets",
        lambda h: [{"entity_id": "notify.kitchen_speak", "name": "Kitchen"}],
    )
    await flow.async_step_custom_devices({"default_targets": ["notify.kitchen_speak"]})
    assert not flow._values["use_all"]
    assert flow._values["default_targets"] == ["notify.kitchen_speak"]
    flow._create.assert_awaited_once()


@pytest.fixture
def options(hass, entry, monkeypatch):
    from custom_components.homecall.config_flow import HomeCallOptionsFlow

    options = HomeCallOptionsFlow()
    options.hass = hass
    options.handler = "entry-id"
    hass.config_entries.async_get_known_entry = Mock(return_value=entry)
    for name in ("async_show_form", "async_show_menu", "async_create_entry"):
        monkeypatch.setattr(options, name, Mock(side_effect=lambda **values: values))
    return options


async def test_options_save_connection_without_losing_device_scope(options, entry):
    entry.options = {"use_all": False, "default_targets": ["notify.kitchen_speak"]}
    assert (await options.async_step_init())["menu_options"] == ["connection", "devices"]
    assert (await options.async_step_connection())["step_id"] == "connection"
    assert (await options.async_step_devices())["step_id"] == "devices"
    result = await options.async_step_custom_address({"public_url": "https://other.example.com/"})
    assert result["data"] == {
        **entry.options,
        "public_url": "https://other.example.com",
        "use_system_url": False,
    }
    assert (await options.async_step_custom_address({"public_url": "http://invalid"}))[
        "errors"
    ] == {"base": "invalid_url"}


async def test_options_system_address(options, monkeypatch):
    await options.async_step_init()
    assert (await options.async_step_system_address())["description_placeholders"][
        "address"
    ] == "https://ha.example.com"
    assert (await options.async_step_system_address({}))["data"]["use_system_url"] is True
    monkeypatch.setattr("custom_components.homecall.config_flow.system_url", lambda h: "")
    assert (await options.async_step_system_address({}))["errors"] == {"base": "no_system_url"}


async def test_options_device_selection(options, monkeypatch, entry):
    monkeypatch.setattr(
        "custom_components.homecall.config_flow.targets",
        lambda h: [{"entity_id": "notify.kitchen_speak", "name": "Kitchen"}],
    )
    await options.async_step_init()
    assert (await options.async_step_custom_devices({"default_targets": []}))["errors"] == {
        "base": "select_echo"
    }
    result = await options.async_step_custom_devices({"default_targets": ["notify.kitchen_speak"]})
    assert result["data"]["use_all"] is False
    assert result["data"]["default_targets"] == ["notify.kitchen_speak"]
    entry.options = result["data"]
    result = await options.async_step_all_devices()
    assert result["data"]["use_all"] is True
    assert result["data"]["default_targets"] == ["notify.kitchen_speak"]
