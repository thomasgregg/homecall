"""Setup and unload register native routes and release retained audio."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from custom_components.homecall import async_setup_entry, async_unload_entry
from custom_components.homecall.const import DOMAIN


async def test_setup_registers_routes_once_and_unload_clears_audio(hass, entry, monkeypatch):
    hass.http = SimpleNamespace(register_view=Mock(), async_register_static_paths=AsyncMock())
    entry.async_on_unload = Mock()
    entry.add_update_listener = Mock(return_value=lambda: None)
    monkeypatch.setattr("custom_components.homecall.frontend.async_panel_exists", lambda h, p: True)
    remove = Mock()
    monkeypatch.setattr("custom_components.homecall.frontend.async_remove_panel", remove)
    assert await async_setup_entry(hass, entry)
    assert hass.http.register_view.call_count == 5
    assert await async_setup_entry(hass, entry)
    assert hass.http.register_view.call_count == 5
    hass.data[DOMAIN]["clips"]["temporary"] = [10, b"clip", 0]
    assert await async_unload_entry(hass, entry)
    assert not hass.data[DOMAIN]["clips"]
    assert "entry" not in hass.data[DOMAIN]
    remove.assert_called_once_with(hass, "homecall", warn_if_unknown=False)


async def test_admin_panel_and_option_listener(hass, entry, monkeypatch):
    hass.http = SimpleNamespace(register_view=Mock(), async_register_static_paths=AsyncMock())
    entry.async_on_unload = Mock()
    entry.add_update_listener = Mock(return_value=lambda: None)
    monkeypatch.setattr(
        "custom_components.homecall.frontend.async_panel_exists", lambda h, p: False
    )
    panel = AsyncMock()
    monkeypatch.setattr("custom_components.homecall.panel_custom.async_register_panel", panel)
    assert await async_setup_entry(hass, entry)
    assert panel.call_args.kwargs["require_admin"] is True
    assert panel.call_args.kwargs["module_url"].startswith(
        "/homecall-assets/homecall-settings.js?v="
    )
    listener = entry.add_update_listener.call_args.args[0]
    changed = SimpleNamespace(options={"use_all": False})
    await listener(hass, changed)
    assert hass.data[DOMAIN]["entry"] is changed
