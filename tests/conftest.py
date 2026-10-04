"""Real Home Assistant imports; fakes only at service and http_request boundaries."""

import asyncio
import io
import wave
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from multidict import MultiDict

from custom_components.homecall.const import DOMAIN


@pytest.fixture
def wav_bytes():
    def make(seconds=1, rate=24000, channels=1, width=2):
        output = io.BytesIO()
        with wave.open(output, "wb") as writer:
            writer.setnchannels(channels)
            writer.setsampwidth(width)
            writer.setframerate(rate)
            writer.writeframes(b"\0" * int(rate * seconds) * channels * width)
        return output.getvalue()

    return make


@pytest.fixture
def entry():
    return SimpleNamespace(
        data={
            "public_url": "https://ha.example.com",
            "use_system_url": False,
            "use_all": True,
            "default_targets": [],
        },
        options={},
    )


@pytest.fixture
def hass(entry):
    async def executor(fn, *args):
        return fn(*args)

    store = {"entry": entry, "lock": asyncio.Lock(), "clips": {}, "registered": False}
    return SimpleNamespace(
        data={DOMAIN: store},
        config=SimpleNamespace(external_url="https://ha.example.com"),
        config_entries=SimpleNamespace(async_update_entry=Mock()),
        services=SimpleNamespace(async_call=AsyncMock()),
        async_add_executor_job=executor,
    )


@pytest.fixture
def http_request():
    class Request(dict):
        query = MultiDict()
        content_length = None

        async def json(self):
            return self.payload

    def make(payload=None, admin=True, targets=(), body=b""):
        r = Request(hass_user=SimpleNamespace(is_admin=admin))
        r.payload = payload
        r.query = MultiDict([("target", t) for t in targets])
        r.content_length = len(body)

        async def chunks(size):
            for offset in range(0, len(body), size):
                yield body[offset : offset + size]

        r.content = SimpleNamespace(iter_chunked=chunks)
        return r

    return make


@pytest.fixture
def devices(monkeypatch):
    result = [
        {"entity_id": "notify.kitchen_speak", "name": "Kitchen", "available": True},
        {"entity_id": "notify.office_speak", "name": "Office", "available": False},
    ]
    monkeypatch.setattr("custom_components.homecall.views.targets", lambda h: result)
    monkeypatch.setattr("custom_components.homecall.helpers.targets", lambda h: result)
    return result
