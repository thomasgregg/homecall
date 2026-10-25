"""Register the bundled dashboard card through Lovelace's resource collection."""

import hashlib
import logging
from pathlib import Path
from urllib.parse import urlsplit

from homeassistant.components.lovelace.const import LOVELACE_DATA, MODE_STORAGE

_LOGGER = logging.getLogger(__name__)
CARD_URL = "/homecall-assets/homecall-card.js"
_LEGACY_PATHS = {
    "/hacsfiles/homecall-card/homecall-card.js",
    "/local/community/homecall-card/homecall-card.js",
    "/local/homecall-card.js",
}


def _is_card_url(url: str) -> bool:
    """Match only known local HomeCall URLs, never similarly named remote files."""
    try:
        parsed = urlsplit(url)
    except ValueError:
        return False
    return (
        not parsed.scheme
        and not parsed.netloc
        and parsed.path
        in {
            CARD_URL,
            *_LEGACY_PATHS,
        }
    )


async def async_register_card(hass):
    """Create or update resources, retaining IDs and unrelated user resources."""
    card_file = Path(__file__).parent / "frontend" / "homecall-card.js"
    revision = await hass.async_add_executor_job(
        lambda: hashlib.sha256(card_file.read_bytes()).hexdigest()[:12]
    )
    url = f"{CARD_URL}?v={revision}"
    lovelace = hass.data[LOVELACE_DATA]
    resources = lovelace.resources
    if lovelace.resource_mode != MODE_STORAGE:
        items = resources.async_items()
        homecall_items = [item for item in items if _is_card_url(item["url"])]
        if len(homecall_items) == 1:
            item = homecall_items[0]
            if urlsplit(item["url"]).path == CARD_URL and item["type"] == "module":
                return
        _LOGGER.warning(
            "HomeCall Card is bundled. YAML-managed dashboard resources must contain "
            "one module resource at %s. Remove any old HomeCall Card resource URLs "
            "and uninstall the separate HACS card; dashboard card settings stay unchanged",
            CARD_URL,
        )
        return

    # This public API loads the collection before inspecting its items. In
    # particular, an unloaded empty collection must not create a duplicate.
    await resources.async_get_info()
    matches = [item for item in resources.async_items() if _is_card_url(item["url"])]
    if not matches:
        await resources.async_create_item({"url": url, "res_type": "module"})
        return
    for item in matches:
        if item["url"] != url or item["type"] != "module":
            await resources.async_update_item(item["id"], {"url": url, "res_type": "module"})
            _LOGGER.info("Updated HomeCall dashboard resource %s to %s", item["url"], url)
    # Preserve even duplicate resource IDs. Identical module URLs execute once
    # in the browser; deleting user-managed entries is unnecessary.
