"""Launch window cache: load precomputed windows from JSON."""

import json
from bisect import bisect_left
from pathlib import Path

_CACHE_PATH = Path(__file__).parent / "data" / "windows.json"
_cache = None


def load_cache() -> dict:
    global _cache
    if _cache is None:
        with open(_CACHE_PATH) as f:
            _cache = json.load(f)
    return _cache


def cache_date_range() -> tuple[str, str]:
    """Return the (start, end) ISO date strings the cache covers."""
    cache = load_cache()
    r = cache["range"]
    return (r[0], r[1])


def lookup_window(origin: str, destination: str, after_iso: str) -> dict | None:
    """Find the first cached window for origin->destination on or after after_iso."""
    cache = load_cache()
    key = f"{origin.lower()}->{destination.lower()}"
    windows = cache["windows"].get(key, [])
    if not windows:
        return None
    dates = [w["launch"] for w in windows]
    idx = bisect_left(dates, after_iso)
    if idx < len(windows):
        return windows[idx]
    return None
