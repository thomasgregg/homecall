"""Verify private per-user preferences and permission checks."""
import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from aiohttp import web

from custom_components.homecall.const import DOMAIN
from custom_components.homecall.views import PreferencesView


@pytest.fixture
def prefs(hass):
    store = hass.data[DOMAIN]
    store["preferences_store"] = SimpleNamespace(async_save=AsyncMock())
    store["preferences"] = {}
    store["preferences_lock"] = asyncio.Lock()
    return store


async def test_per_user_selection(hass, http_request, devices, prefs):
    first = http_request({"selected_targets": ["notify.kitchen_speak"]})
    first["hass_user"].id = "user-a"
    view = PreferencesView(hass)
    assert json.loads((await view.get(first)).body)["selected_targets"] is None
    assert (await view.post(first)).status == 200
    assert json.loads((await view.get(first)).body)["selected_targets"] == ["notify.kitchen_speak"]
    other = http_request()
    other["hass_user"].id = "user-b"
    assert json.loads((await view.get(other)).body)["selected_targets"] is None


async def test_unknown_target_rejected(hass, http_request, devices, prefs):
    request = http_request({"selected_targets": ["media_player.secret"]})
    request["hass_user"].id = "user-a"
    with pytest.raises(web.HTTPForbidden):
        await PreferencesView(hass).post(request)
    prefs["preferences_store"].async_save.assert_not_awaited()


async def test_explicit_empty_selection_persists(hass, http_request, devices, prefs):
    request = http_request({"selected_targets": []})
    request["hass_user"].id = "user-a"
    await PreferencesView(hass).post(request)
    assert json.loads((await PreferencesView(hass).get(request)).body)["selected_targets"] == []
