"""Shared HomeCall constants and connection validation."""

from urllib.parse import urlsplit

DOMAIN = "homecall"
MAX_BYTES = 6_000_000
TTL = 180
UPLOAD_TIMEOUT = 30
DELIVERY_TIMEOUT = 30


def valid_url(url):
    try:
        p = urlsplit(url)
        return (
            p.scheme == "https"
            and bool(p.hostname)
            and not any((p.username, p.password, p.query, p.fragment, p.path))
        )
    except ValueError:
        return False
