"""Tests for the cache generation script — validates correctness against ephemeris.

All tests are marked slow (skipped by default). Run with: pytest -m slow
"""

import hashlib
import warnings
from pathlib import Path

import astropy.units as u
import pytest
from astropy.time import Time
from erfa import ErfaWarning

from app.engine.generate_cache import generate_pair, generate_all, generate_batch

# Suppress ERFA warnings for dates past ~2050
warnings.filterwarnings("ignore", category=ErfaWarning)

_GENERATE_CACHE_PATH = Path(__file__).resolve().parent.parent / "app" / "engine" / "generate_cache.py"
_HASH_PATH = Path(__file__).resolve().parent / ".generate_cache_hash"


def _current_hash() -> str:
    # read_text normalizes line endings so the hash matches across Windows (CRLF) and Linux CI (LF)
    text = _GENERATE_CACHE_PATH.read_text(encoding="utf-8")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def test_generate_cache_hash_current():
    """Fails if generate_cache.py changed since slow tests were last run.

    Fix by running: pytest -m slow
    """
    if not _HASH_PATH.exists():
        pytest.fail(
            "Slow tests have never been run. "
            "Run: pytest -m slow"
        )
    saved = _HASH_PATH.read_text().strip()
    if saved != _current_hash():
        pytest.fail(
            "generate_cache.py changed since slow tests were last run. "
            "Run: pytest -m slow"
        )


@pytest.fixture(autouse=True, scope="session")
def _save_hash_after_slow_tests(request):
    """After slow tests pass, save the hash so the fast check knows."""
    yield
    # Only save if we actually ran slow tests
    slow_items = [i for i in request.session.items if i.get_closest_marker("slow")]
    if slow_items:
        _HASH_PATH.write_text(_current_hash())


@pytest.mark.slow
def test_generate_pair_returns_list():
    windows = generate_pair("earth", "mars", "2026-01-01", "2030-01-01")
    assert isinstance(windows, list)
    assert len(windows) > 0


@pytest.mark.slow
def test_generate_pair_earth_mars_count():
    """Earth-Mars synodic period ~780 days, so ~23 windows over 50 years."""
    windows = generate_pair("earth", "mars", "2025-01-01", "2075-01-01")
    assert 15 <= len(windows) <= 30


@pytest.mark.slow
def test_generate_pair_window_fields():
    windows = generate_pair("earth", "mars", "2026-01-01", "2028-01-01")
    w = windows[0]
    assert "l" in w
    assert "tt" in w
    assert "dd" in w
    assert "ad" in w
    assert "dv" in w


@pytest.mark.slow
def test_generate_pair_accuracy_vs_ephemeris():
    """Generated launch date should match the live ephemeris computation."""
    from app.engine.ephemeris import phase_angle, required_phase_angle
    import numpy as np

    windows = generate_pair("earth", "mars", "2026-06-01", "2030-01-01")
    launch = Time(windows[0]["l"])
    actual = phase_angle("earth", "mars", launch).to(u.rad).value
    required = required_phase_angle("earth", "mars").to(u.rad).value
    error = abs(((actual - required + np.pi) % (2 * np.pi)) - np.pi)
    assert error < 0.1  # within ~6 degrees


@pytest.mark.slow
def test_generate_pair_dates_sorted():
    windows = generate_pair("earth", "mars", "2025-01-01", "2075-01-01")
    dates = [w["l"] for w in windows]
    assert dates == sorted(dates)


@pytest.mark.slow
def test_generate_all_has_56_pairs():
    result = generate_all("2026-01-01", "2028-01-01")
    assert "w" in result
    assert len(result["w"]) == 56


@pytest.mark.slow
def test_generate_all_structure():
    result = generate_all("2026-01-01", "2028-01-01")
    assert "gen" in result
    assert "range" in result
    assert "legend" in result
    assert result["range"] == ["2026-01-01", "2028-01-01"]
    for key in result["w"]:
        parts = key.split("->")
        assert len(parts) == 2


@pytest.mark.slow
def test_generate_batch_writes_json(tmp_path, monkeypatch):
    import json
    import app.engine.generate_cache as gc

    monkeypatch.setattr(gc, "_DATA_DIR", tmp_path)
    generate_batch("2026-01-01", "2028-01-01")
    out = tmp_path / "windows_2026_2028.json"
    assert out.exists()
    data = json.loads(out.read_text())
    assert "w" in data
    assert len(data["w"]) == 56
