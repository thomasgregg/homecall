"""HomeCall: original-voice announcements through Alexa devices."""

import asyncio
import hashlib
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig

from .const import DOMAIN
from .views import AudioView, SettingsView, StatusView, UploadView


async def async_setup_entry(hass, entry):
    store = hass.data.setdefault(DOMAIN, {"lock": asyncio.Lock(), "clips": {}, "registered": False})
    store["entry"] = entry

    async def update_options(hass, updated_entry):
        store["entry"] = updated_entry

    entry.async_on_unload(entry.add_update_listener(update_options))
    if not store["registered"]:
        hass.http.register_view(StatusView(hass))
        hass.http.register_view(UploadView(hass))
        hass.http.register_view(AudioView(hass))
        hass.http.register_view(SettingsView(hass))
        await hass.http.async_register_static_paths(
            [StaticPathConfig("/homecall-assets", str(Path(__file__).parent / "frontend"), False)]
        )
        store["registered"] = True
    if not frontend.async_panel_exists(hass, "homecall"):
        settings_file = Path(__file__).parent / "frontend" / "homecall-settings.js"
        settings_revision = await hass.async_add_executor_job(
            lambda: hashlib.sha256(settings_file.read_bytes()).hexdigest()[:12]
        )
        await panel_custom.async_register_panel(
            hass,
            frontend_url_path="homecall",
            webcomponent_name="homecall-settings",
            module_url=f"/homecall-assets/homecall-settings.js?v={settings_revision}",
            require_admin=True,
            config_panel_domain=DOMAIN,
        )
    return True


async def async_unload_entry(hass, entry):
    store = hass.data.get(DOMAIN, {})
    store.pop("entry", None)
    store.get("clips", {}).clear()
    frontend.async_remove_panel(hass, "homecall", warn_if_unknown=False)
    return True
