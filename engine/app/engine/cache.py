"""Launch window cache: load precomputed windows from JSON.

The JSON file uses short field names for compactness.
This module translates them to long names for callers:
  l  -> launch
  tt -> transfer_time_days
  dd -> departure_dv_km_s
  ad -> arrival_dv_km_s
  dv -> delta_v_total_km_s
"""

import json
from bisect import bisect_left
from pathlib import Path

_CACHE_PATH = Path(__file__).parent / "data" / "windows.json"
_cache = None


def _expand_window(w: dict) -> dict:
    """Translate short JSON keys to the long names callers expect."""
    return {
        "launch": w["l"],
        "transfer_time_days": w["tt"],
        "departure_dv_km_s": w["dd"],
        "arrival_dv_km_s": w["ad"],
        "delta_v_total_km_s": w["dv"],
    }


def load_cache() -> dict:
    """Load and translate the JSON cache into the public format."""
    global _cache
    if _cache is None:
        raw = json.loads(_CACHE_PATH.read_text())
        _cache = {
            "generated": raw["gen"],
            "range": raw["range"],
            "windows": {
                key: [_expand_window(w) for w in windows]
                for key, windows in raw["w"].items()
            },
        }
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
