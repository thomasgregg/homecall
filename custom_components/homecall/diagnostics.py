"""Short-lived stage timings, separate from audio bearer tokens."""

import asyncio
import json
import secrets
import time
from pathlib import Path

from .const import TTL

VERSION = json.loads((Path(__file__).parent / "manifest.json").read_text())["version"]


def start_diagnostics(store, request):
    identifier = secrets.token_hex(16)
    trace = {
        "diagnostic_id": identifier,
        "integration_version": VERSION,
        "timings_ms": {},
        "deliveries": [],
        "audio_fetches": 0,
        "_owner": getattr(request["hass_user"], "id", None),
        "_expires": time.monotonic() + TTL,
    }
    traces = store.setdefault("diagnostics", {})
    now = time.monotonic()
    for key, value in list(traces.items()):
        if value["_expires"] <= now:
            traces.pop(key, None)
    # Audio clips are also capped at 20. Bound traces even after failed requests.
    if len(traces) >= 20:
        traces.pop(next(iter(traces)))
    traces[identifier] = trace

    def expire():
        if traces.get(identifier) is not trace:
            return
        remaining = trace["_expires"] - time.monotonic()
        if remaining > 0:
            asyncio.get_running_loop().call_later(remaining, expire)
        else:
            traces.pop(identifier, None)

    asyncio.get_running_loop().call_later(TTL, expire)
    return trace


def elapsed_ms(start):
    return round((time.monotonic() - start) * 1000, 1)


def public_diagnostics(trace):
    """Never expose audio URLs, tokens, user IDs, or source audio."""
    return {key: value for key, value in trace.items() if not key.startswith("_")}
