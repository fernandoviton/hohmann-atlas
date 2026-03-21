"""Tests for the cache generation script — validates correctness against ephemeris."""

import warnings

import astropy.units as u
from astropy.time import Time
from erfa import ErfaWarning

from app.engine.generate_cache import generate_pair, generate_all

# Suppress ERFA warnings for dates past ~2050
warnings.filterwarnings("ignore", category=ErfaWarning)


def test_generate_pair_returns_list():
    windows = generate_pair("earth", "mars", "2026-01-01", "2030-01-01")
    assert isinstance(windows, list)
    assert len(windows) > 0


def test_generate_pair_earth_mars_count():
    """Earth-Mars synodic period ~780 days, so ~23 windows over 50 years."""
    windows = generate_pair("earth", "mars", "2025-01-01", "2075-01-01")
    assert 15 <= len(windows) <= 30


def test_generate_pair_window_fields():
    windows = generate_pair("earth", "mars", "2026-01-01", "2028-01-01")
    w = windows[0]
    assert "launch" in w
    assert "transfer_time_days" in w
    assert "departure_dv_km_s" in w
    assert "arrival_dv_km_s" in w
    assert "delta_v_total_km_s" in w


def test_generate_pair_accuracy_vs_ephemeris():
    """Generated launch date should match the live ephemeris computation."""
    from app.engine.ephemeris import phase_angle, required_phase_angle
    import numpy as np

    windows = generate_pair("earth", "mars", "2026-06-01", "2030-01-01")
    launch = Time(windows[0]["launch"])
    # Check the phase angle is near the required angle at launch
    actual = phase_angle("earth", "mars", launch).to(u.rad).value
    required = required_phase_angle("earth", "mars").to(u.rad).value
    error = abs(((actual - required + np.pi) % (2 * np.pi)) - np.pi)
    assert error < 0.1  # within ~6 degrees


def test_generate_pair_dates_sorted():
    windows = generate_pair("earth", "mars", "2025-01-01", "2075-01-01")
    dates = [w["launch"] for w in windows]
    assert dates == sorted(dates)


def test_generate_all_has_56_pairs():
    result = generate_all("2026-01-01", "2028-01-01")
    assert "windows" in result
    assert len(result["windows"]) == 56


def test_generate_all_structure():
    result = generate_all("2026-01-01", "2028-01-01")
    assert "generated" in result
    assert "range" in result
    assert result["range"] == ["2026-01-01", "2028-01-01"]
    for key in result["windows"]:
        parts = key.split("->")
        assert len(parts) == 2


def test_generate_writes_json(tmp_path):
    import json
    from app.engine.generate_cache import generate_and_write

    out = tmp_path / "windows.json"
    generate_and_write(str(out), "2026-01-01", "2028-01-01")
    data = json.loads(out.read_text())
    assert "windows" in data
    assert len(data["windows"]) == 56
