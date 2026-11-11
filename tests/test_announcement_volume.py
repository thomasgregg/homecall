"""Temporary Sonos announcement volume is scoped to the announced clip."""
import pytest

from custom_components.homecall.views import deliver


@pytest.mark.parametrize("volume", [0, 25, 60, 100])
async def test_sonos_announcement_volume(hass, entry, monkeypatch, volume):
    monkeypatch.setattr(
        "custom_components.homecall.views.dlna_candidates",
        lambda h: [
            {"entity_id": "media_player.salon", "transport": "sonos", "available": True}
        ],
    )
    monkeypatch.setattr(
        "custom_components.homecall.views.local_url",
        lambda h, e: "http://192.168.1.2:8123",
    )
    result = await deliver(hass, entry, "media_player.salon", "token", volume=volume)
    assert result["accepted"]
    args = hass.services.async_call.call_args.args
    assert args[:2] == ("media_player", "play_media")
    assert args[2]["announce"] is True
    assert args[2]["extra"] == {"volume": volume}
    assert "volume_set" not in str(hass.services.async_call.call_args)
