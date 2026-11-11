"""HomeCall shows the real HA area without changing friendly names."""

from types import SimpleNamespace

from custom_components.homecall.helpers import entity_area_name


def test_entity_area_takes_priority(hass, monkeypatch):
    from custom_components.homecall import helpers

    monkeypatch.setattr(
        helpers.ar,
        "async_get",
        lambda h: SimpleNamespace(async_get_area=lambda key: SimpleNamespace(name=f"Area {key}")),
    )
    entity = SimpleNamespace(area_id="kitchen", device_id=None)
    assert entity_area_name(hass, entity) == "Area kitchen"


def test_device_area_is_used_when_entity_has_none(hass, monkeypatch):
    from custom_components.homecall import helpers

    monkeypatch.setattr(
        helpers.dr,
        "async_get",
        lambda h: SimpleNamespace(async_get=lambda key: SimpleNamespace(area_id="salon")),
    )
    monkeypatch.setattr(
        helpers.ar,
        "async_get",
        lambda h: SimpleNamespace(async_get_area=lambda key: SimpleNamespace(name="Salon")),
    )
    entity = SimpleNamespace(area_id=None, device_id="amp")
    assert entity_area_name(hass, entity) == "Salon"


def test_unassigned_area_is_not_invented(hass):
    entity = SimpleNamespace(area_id=None, device_id=None)
    assert entity_area_name(hass, entity) is None
