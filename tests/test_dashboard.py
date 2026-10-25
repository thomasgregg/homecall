"""Exercise bundling and migration against real Home Assistant collections."""

import hashlib
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from homeassistant.components.lovelace.resources import ResourceYAMLCollection

from custom_components.homecall.dashboard import CARD_URL, async_register_card

CARD_FILE = (
    Path(__file__).resolve().parents[1] / "custom_components/homecall/frontend/homecall-card.js"
)


def expected_url():
    return f"{CARD_URL}?v={hashlib.sha256(CARD_FILE.read_bytes()).hexdigest()[:12]}"


async def test_new_resource_loads_before_registration_and_is_idempotent(hass):
    resources = hass.data["lovelace"].resources
    await async_register_card(hass)
    (item,) = resources.async_items()
    assert item == {"id": item["id"], "url": expected_url(), "type": "module"}
    resources.store.async_load.assert_awaited_once()
    resources.store.async_delay_save.reset_mock()
    await async_register_card(hass)
    assert resources.async_items() == [item]
    resources.store.async_delay_save.assert_not_called()


@pytest.mark.parametrize(
    "path",
    [
        "/hacsfiles/homecall-card/homecall-card.js?hacstag=123",
        "/local/community/homecall-card/homecall-card.js?v=old",
        "/local/homecall-card.js",
        CARD_URL + "?v=old",
    ],
)
async def test_existing_resource_keeps_id_and_uses_current_module(hass, path):
    resources = hass.data["lovelace"].resources
    resources.store.async_load.return_value = {
        "items": [
            {"id": "existing", "url": path, "type": "js"},
            {"id": "unrelated", "url": "/local/other.js", "type": "module"},
        ]
    }
    await async_register_card(hass)
    assert resources.async_items() == [
        {"id": "existing", "url": expected_url(), "type": "module"},
        {"id": "unrelated", "url": "/local/other.js", "type": "module"},
    ]
    await async_register_card(hass)
    assert len(resources.async_items()) == 2


async def test_duplicates_converge_without_deleting_resources(hass):
    resources = hass.data["lovelace"].resources
    resources.store.async_load.return_value = {
        "items": [
            {"id": "a", "url": "/local/homecall-card.js", "type": "module"},
            {"id": "b", "url": CARD_URL + "?v=old", "type": "module"},
        ]
    }
    await async_register_card(hass)
    assert {i["id"] for i in resources.async_items()} == {"a", "b"}
    assert {i["url"] for i in resources.async_items()} == {expected_url()}


@pytest.mark.parametrize(
    "url",
    [
        "https://example.com/local/homecall-card.js",
        "//example.com/local/homecall-card.js",
        "https://[invalid/homecall-card.js",
        "/local/my-homecall-card.js",
        "/hacsfiles/other/homecall-card.js",
    ],
)
async def test_custom_and_remote_resources_are_untouched(hass, url):
    resources = hass.data["lovelace"].resources
    original = {"id": "custom", "url": url, "type": "module"}
    resources.store.async_load.return_value = {"items": [original.copy()]}
    await async_register_card(hass)
    assert resources.async_items()[0] == original
    assert resources.async_items()[1]["url"] == expected_url()


async def test_yaml_resources_remain_read_only_and_log_instructions(hass, caplog):
    original = [{"url": "/local/homecall-card.js", "type": "module"}]
    resources = ResourceYAMLCollection(original.copy())
    hass.data["lovelace"] = SimpleNamespace(resource_mode="yaml", resources=resources)
    await async_register_card(hass)
    assert resources.async_items() == original
    assert CARD_URL in caplog.text
    assert "YAML-managed" in caplog.text


async def test_content_change_updates_cache_key(hass, monkeypatch):
    await async_register_card(hass)
    old = hass.data["lovelace"].resources.async_items()[0]
    monkeypatch.setattr(Path, "read_bytes", lambda _: b"changed card content")
    await async_register_card(hass)
    new = hass.data["lovelace"].resources.async_items()[0]
    assert new["id"] == old["id"]
    assert new["url"] != old["url"]


async def test_storage_failure_is_not_hidden(hass):
    resources = hass.data["lovelace"].resources
    resources.store.async_load = AsyncMock(side_effect=OSError("cannot load resources"))
    with pytest.raises(OSError, match="cannot load resources"):
        await async_register_card(hass)


async def test_configured_yaml_resource_needs_no_warning(hass, caplog):
    original = [{"url": CARD_URL, "type": "module"}]
    resources = ResourceYAMLCollection(original.copy())
    hass.data["lovelace"] = SimpleNamespace(resource_mode="yaml", resources=resources)
    await async_register_card(hass)
    assert resources.async_items() == original
    assert not caplog.records
