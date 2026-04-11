"""Tests for the launch window cache loader and lookup."""

import astropy.units as u
from astropy.time import Time

from app.engine.cache import load_cache, lookup_window
from app.engine.launch import LaunchWindow, find_next_window


def test_cache_file_loads():
    cache = load_cache()
    assert isinstance(cache, dict)
    assert "windows" in cache
    assert "generated" in cache
    assert "range" in cache


def test_cache_has_56_pairs():
    cache = load_cache()
    assert len(cache["windows"]) == 56


def test_cache_key_format():
    from app.engine.bodies import PLANETS

    cache = load_cache()
    planet_names = {p.name.lower() for p in PLANETS}
    for key in cache["windows"]:
        origin, dest = key.split("->")
        assert origin in planet_names
        assert dest in planet_names
        assert origin != dest


def test_cache_windows_sorted():
    cache = load_cache()
    for key, windows in cache["windows"].items():
        dates = [w["launch"] for w in windows]
        assert dates == sorted(dates), f"{key} not sorted"


def test_lookup_window_finds_result():
    w = lookup_window("earth", "mars", "2026-06-01")
    assert w is not None
    assert w["launch"] >= "2026-06-01"


def test_lookup_window_before_range():
    """Querying before cache start returns the first window."""
    w = lookup_window("earth", "mars", "2020-01-01")
    assert w is not None


def test_find_next_window_uses_cache(monkeypatch):
    """find_next_window should not call get_body (ephemeris) at runtime."""
    import app.engine.ephemeris as eph

    calls = []
    original = eph.heliocentric_longitude

    def spy(*args, **kwargs):
        calls.append(1)
        return original(*args, **kwargs)

    monkeypatch.setattr(eph, "heliocentric_longitude", spy)
    find_next_window("earth", "mars", Time("2026-06-01"))
    assert len(calls) == 0, "Expected no ephemeris calls when using cache"


def test_find_next_window_returns_launch_window():
    w = find_next_window("earth", "mars", Time("2026-06-01"))
    assert isinstance(w, LaunchWindow)
    assert w.origin == "Earth"
    assert w.destination == "Mars"


def test_find_next_window_plausible():
    w = find_next_window("earth", "mars", Time("2026-06-01"))
    assert w.launch_date > Time("2026-06-01")
    days = w.transfer_time.to(u.day).value
    assert 250 < days < 270
