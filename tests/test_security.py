"""Regressions for request deadlines and per-user speaker permissions."""

import asyncio
import json
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from homeassistant.auth.permissions import PolicyPermissions
from homeassistant.auth.permissions.const import POLICY_CONTROL, POLICY_READ

from custom_components.homecall.const import DOMAIN
from custom_components.homecall.views import HomeCallView, SpeakerTestView, StatusView, UploadView


@pytest.fixture
def fast_deadlines(monkeypatch):
    monkeypatch.setattr("custom_components.homecall.views.UPLOAD_TIMEOUT", 0.02)
    monkeypatch.setattr("custom_components.homecall.views.DELIVERY_TIMEOUT", 0.02)
    monkeypatch.setattr(HomeCallView, "context", lambda self, request: None)
    monkeypatch.setattr("custom_components.homecall.views.convert_wav", lambda *args: b"mp3")
    monkeypatch.setattr("custom_components.homecall.views.test_audio", lambda: b"mp3")


@pytest.mark.parametrize("trickle", [False, True])
async def test_upload_deadline_releases_lock_without_sending(
    hass, devices, http_request, wav_bytes, fast_deadlines, trickle
):
    closed = asyncio.Event()

    async def slow_body(size):
        try:
            while True:
                if not trickle:
                    await asyncio.Event().wait()
                await asyncio.sleep(0.001)
                yield b"x"
        finally:
            closed.set()

    request = http_request(targets=[devices[0]["entity_id"]])
    request.content_length = None
    request.content.iter_chunked = slow_body
    response = await asyncio.wait_for(UploadView(hass).post(request), 1)
    assert response.status == 408
    assert closed.is_set()
    assert not hass.data[DOMAIN]["lock"].locked()
    assert not hass.data[DOMAIN]["clips"]
    hass.services.async_call.assert_not_awaited()
    retry = await UploadView(hass).post(
        http_request(targets=[devices[0]["entity_id"]], body=wav_bytes())
    )
    assert retry.status == 200
    assert json.loads(retry.body)["results"][0]["accepted"]


async def test_cancelled_upload_releases_lock(hass, devices, http_request, fast_deadlines):
    entered = asyncio.Event()

    async def body(size):
        entered.set()
        await asyncio.Event().wait()
        yield b""

    request = http_request(targets=[devices[0]["entity_id"]])
    request.content.iter_chunked = body
    task = asyncio.create_task(UploadView(hass).post(request))
    await entered.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert not hass.data[DOMAIN]["lock"].locked()
    hass.services.async_call.assert_not_awaited()


async def test_delivery_timeout_preserves_successful_peer_and_allows_retry(
    hass, devices, http_request, wav_bytes, fast_deadlines
):
    devices[1]["available"] = True
    cancelled = asyncio.Event()

    async def service(domain, name, data, **kwargs):
        if data["entity_id"] == devices[0]["entity_id"]:
            try:
                await asyncio.Event().wait()
            finally:
                cancelled.set()

    hass.services.async_call.side_effect = service
    response = await asyncio.wait_for(
        UploadView(hass).post(
            http_request(targets=[d["entity_id"] for d in devices], body=wav_bytes())
        ),
        1,
    )
    assert json.loads(response.body)["results"] == [
        {"entity_id": devices[0]["entity_id"], "accepted": False},
        {"entity_id": devices[1]["entity_id"], "accepted": True},
    ]
    assert cancelled.is_set()
    assert not hass.data[DOMAIN]["lock"].locked()
    retry = await UploadView(hass).post(
        http_request(targets=[devices[1]["entity_id"]], body=wav_bytes())
    )
    assert json.loads(retry.body)["results"][0]["accepted"]


async def test_speaker_test_timeout_cleans_clip_and_resume(
    hass, devices, http_request, fast_deadlines
):
    manager = Mock()
    hass.data[DOMAIN]["resume_manager"] = manager

    async def blocked(*args, **kwargs):
        await asyncio.Event().wait()

    hass.services.async_call.side_effect = blocked
    response = await asyncio.wait_for(
        SpeakerTestView(hass).post(
            http_request({"action": "test", "entity_id": devices[0]["entity_id"]})
        ),
        1,
    )
    assert response.status == 400
    assert not hass.data[DOMAIN]["lock"].locked()
    assert not hass.data[DOMAIN]["clips"]
    manager.cancel.assert_called_with(devices[0]["entity_id"])


def restricted_user(entity, *, read=False, control=False):
    # Use HA's actual permission compiler, including its default-deny behavior.
    return SimpleNamespace(
        id="restricted",
        is_admin=False,
        permissions=PolicyPermissions(
            {"entities": {"entity_ids": {entity: {POLICY_READ: read, POLICY_CONTROL: control}}}},
            None,
        ),
    )


@pytest.mark.parametrize("read", [False, True])
async def test_status_respects_entity_read_permissions(hass, devices, http_request, read):
    request = http_request()
    request["hass_user"] = restricted_user(devices[0]["entity_id"], read=read)
    result = json.loads((await StatusView(hass).get(request)).body)
    assert result["targets"] == (devices[:1] if read else [])
    assert devices[1]["entity_id"] not in json.dumps(result)


@pytest.mark.parametrize("read,control", [(False, False), (False, True), (True, False)])
async def test_denied_upload_does_not_read_audio_or_call_service(
    hass, devices, http_request, fast_deadlines, read, control
):
    request = http_request(targets=[devices[0]["entity_id"]])
    request["hass_user"] = restricted_user(devices[0]["entity_id"], read=read, control=control)
    request.content.iter_chunked = Mock(side_effect=AssertionError("must not consume body"))
    assert (await UploadView(hass).post(request)).status == 400
    request.content.iter_chunked.assert_not_called()
    hass.services.async_call.assert_not_awaited()
    assert not hass.data[DOMAIN]["clips"]


async def test_permitted_nonadmin_can_send(hass, devices, http_request, wav_bytes, fast_deadlines):
    request = http_request(targets=[devices[0]["entity_id"]], body=wav_bytes())
    request["hass_user"] = restricted_user(devices[0]["entity_id"], read=True, control=True)
    response = await UploadView(hass).post(request)
    assert json.loads(response.body)["results"][0]["accepted"]


async def test_permissions_revoked_during_encoding_prevent_delivery(
    hass, devices, http_request, wav_bytes, fast_deadlines
):
    request = http_request(targets=[devices[0]["entity_id"]], body=wav_bytes())
    request["hass_user"] = restricted_user(devices[0]["entity_id"], read=True, control=True)
    executor = hass.async_add_executor_job

    async def revoke(fn, *args):
        result = await executor(fn, *args)
        if fn.__name__ == "<lambda>":
            request["hass_user"].permissions = restricted_user(devices[0]["entity_id"]).permissions
        return result

    hass.async_add_executor_job = revoke
    assert (await UploadView(hass).post(request)).status == 400
    hass.services.async_call.assert_not_awaited()
    assert not hass.data[DOMAIN]["clips"]
