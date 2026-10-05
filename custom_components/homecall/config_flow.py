"""HomeCall setup and native fallback options."""

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import DOMAIN, valid_url
from .helpers import settings, system_url, targets


def connection_schema(values):
    return vol.Schema(
        {
            vol.Required("public_url", default=values.get("public_url", "")): selector.TextSelector(
                selector.TextSelectorConfig(type=selector.TextSelectorType.URL)
            )
        }
    )


def devices_schema(hass, values):
    choices = [
        {"value": t["entity_id"], "label": t["name"]}
        for t in targets(hass)
        if t.get("transport") != "dlna"
    ]
    ids = {t["value"] for t in choices}
    selected = [x for x in values.get("default_targets", []) if x in ids]
    return vol.Schema(
        {
            vol.Required("default_targets", default=selected): selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=choices, multiple=True, mode=selector.SelectSelectorMode.LIST
                )
            )
        }
    )


class HomeCallConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return HomeCallOptionsFlow()

    async def async_step_user(self, user_input=None):
        if not hasattr(self, "_values"):
            self._values = {
                "public_url": system_url(self.hass),
                "use_system_url": True,
                "use_all": True,
                "default_targets": [],
            }
        return self.async_show_menu(
            step_id="user",
            menu_options=[
                "alexa_setup",
                "dlna_setup",
                "music_assistant_setup",
                "cast_setup",
                "echomuse_setup",
            ],
        )

    async def async_step_alexa_setup(self, user_input=None):
        return await self.async_step_connection()

    async def async_step_dlna_setup(self, user_input=None):
        self._values.update(public_url="", use_system_url=False, use_all=False)
        if user_input is not None:
            return await self._create()
        return self.async_show_form(
            step_id="dlna_setup", data_schema=vol.Schema({}), last_step=True
        )

    async def async_step_echomuse_setup(self, user_input=None):
        self._values.update(public_url="", use_system_url=False, use_all=False)
        if user_input is not None:
            return await self._create()
        return self.async_show_form(
            step_id="echomuse_setup", data_schema=vol.Schema({}), last_step=True
        )

    async def async_step_cast_setup(self, user_input=None):
        self._values.update(public_url="", use_system_url=False, use_all=False)
        if user_input is not None:
            return await self._create()
        return self.async_show_form(
            step_id="cast_setup", data_schema=vol.Schema({}), last_step=True
        )

    async def async_step_music_assistant_setup(self, user_input=None):
        self._values.update(public_url="", use_system_url=False, use_all=False)
        if user_input is not None:
            return await self._create()
        return self.async_show_form(
            step_id="music_assistant_setup", data_schema=vol.Schema({}), last_step=True
        )

    async def async_step_connection(self, user_input=None):
        return self.async_show_menu(
            step_id="connection", menu_options=["system_address", "custom_address"]
        )

    async def async_step_system_address(self, user_input=None):
        url = system_url(self.hass)
        if not url:
            return self.async_show_form(
                step_id="system_address",
                data_schema=vol.Schema({}),
                errors={"base": "no_system_url"},
                description_placeholders={"address": "—"},
            )
        if user_input is not None:
            self._values.update(use_system_url=True, public_url=url)
            return await self.async_step_devices()
        return self.async_show_form(
            step_id="system_address",
            data_schema=vol.Schema({}),
            description_placeholders={"address": url},
        )

    async def async_step_custom_address(self, user_input=None):
        errors = {}
        if user_input is not None:
            url = user_input["public_url"].strip().rstrip("/")
            self._values["public_url"] = url
            self._values["use_system_url"] = False
            if valid_url(url):
                return await self.async_step_devices()
            errors["base"] = "invalid_url"
        return self.async_show_form(
            step_id="custom_address",
            data_schema=connection_schema(self._values),
            errors=errors,
            last_step=False,
        )

    async def async_step_devices(self, user_input=None):
        return self.async_show_menu(
            step_id="devices", menu_options=["all_devices", "custom_devices", "connection"]
        )

    async def async_step_all_devices(self, user_input=None):
        self._values["use_all"] = True
        return await self._create()

    async def async_step_custom_devices(self, user_input=None):
        errors = {}
        if user_input is not None:
            selected = user_input.get("default_targets", [])
            ids = {t["entity_id"] for t in targets(self.hass)}
            if selected and set(selected).issubset(ids):
                self._values.update(use_all=False, default_targets=selected)
                return await self._create()
            self._values["default_targets"] = selected
            errors["base"] = "select_echo"
        return self.async_show_form(
            step_id="custom_devices",
            data_schema=devices_schema(self.hass, self._values),
            errors=errors,
            last_step=True,
        )

    async def _create(self):
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        return self.async_create_entry(title="HomeCall", data=self._values)


class HomeCallOptionsFlow(config_entries.OptionsFlow):
    """API/native fallback; the graphical config panel is preferred by HA."""

    async def async_step_init(self, user_input=None):
        self._values = settings(self.config_entry, self.hass)
        return self.async_show_menu(step_id="init", menu_options=["connection", "devices"])

    async def async_step_music_assistant_setup(self, user_input=None):
        self._values.update(public_url="", use_system_url=False, use_all=False)
        if user_input is not None:
            return await self._create()
        return self.async_show_form(
            step_id="music_assistant_setup", data_schema=vol.Schema({}), last_step=True
        )

    async def async_step_connection(self, user_input=None):
        return self.async_show_menu(
            step_id="connection", menu_options=["system_address", "custom_address"]
        )

    async def async_step_system_address(self, user_input=None):
        url = system_url(self.hass)
        if not url:
            return self.async_show_form(
                step_id="system_address",
                data_schema=vol.Schema({}),
                errors={"base": "no_system_url"},
                description_placeholders={"address": "—"},
            )
        if user_input is not None:
            return self.async_create_entry(
                title="",
                data={**self.config_entry.options, "use_system_url": True, "public_url": url},
            )
        return self.async_show_form(
            step_id="system_address",
            data_schema=vol.Schema({}),
            description_placeholders={"address": url},
        )

    async def async_step_custom_address(self, user_input=None):
        errors = {}
        if user_input is not None:
            url = user_input["public_url"].strip().rstrip("/")
            if valid_url(url):
                return self.async_create_entry(
                    title="",
                    data={**self.config_entry.options, "public_url": url, "use_system_url": False},
                )
            self._values["public_url"] = url
            errors["base"] = "invalid_url"
        return self.async_show_form(
            step_id="custom_address", data_schema=connection_schema(self._values), errors=errors
        )

    async def async_step_devices(self, user_input=None):
        return self.async_show_menu(
            step_id="devices", menu_options=["all_devices", "custom_devices", "init"]
        )

    async def async_step_all_devices(self, user_input=None):
        return self.async_create_entry(
            title="", data={**self.config_entry.options, "use_all": True}
        )

    async def async_step_custom_devices(self, user_input=None):
        errors = {}
        if user_input is not None:
            selected = user_input.get("default_targets", [])
            ids = {t["entity_id"] for t in targets(self.hass)}
            if selected and set(selected).issubset(ids):
                return self.async_create_entry(
                    title="",
                    data={
                        **self.config_entry.options,
                        "use_all": False,
                        "default_targets": list(
                            dict.fromkeys(
                                [
                                    *selected,
                                    *[
                                        x
                                        for x in self._values["default_targets"]
                                        if x.startswith("media_player.")
                                    ],
                                ]
                            )
                        ),
                    },
                )
            self._values["default_targets"] = selected
            errors["base"] = "select_echo"
        return self.async_show_form(
            step_id="custom_devices",
            data_schema=devices_schema(self.hass, self._values),
            errors=errors,
        )
