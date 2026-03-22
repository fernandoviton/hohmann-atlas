"""Tests for CLI argument parsing and dispatch."""

import re
import subprocess
import sys


def test_transfer_default_shows_table():
    """Existing `hohmann-atlas earth` should still work."""
    result = subprocess.run(
        [sys.executable, "-m", "app.cli", "earth"],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0
    assert "Mars" in result.stdout
    assert "km/s" in result.stdout


def test_transfer_subcommand():
    """Explicit `hohmann-atlas transfer earth` should work."""
    result = subprocess.run(
        [sys.executable, "-m", "app.cli", "transfer", "earth"],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0
    assert "Mars" in result.stdout


def test_unknown_planet_error():
    result = subprocess.run(
        [sys.executable, "-m", "app.cli", "pluto"],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode != 0


def test_no_args_shows_usage():
    result = subprocess.run(
        [sys.executable, "-m", "app.cli"],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode != 0


def test_tour_subcommand_requires_date():
    """Tour without --date should fail."""
    result = subprocess.run(
        [sys.executable, "-m", "app.cli", "tour", "earth"],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode != 0


def test_tour_depth_1():
    """Tour with depth=1 should be fast and show destinations."""
    result = subprocess.run(
        [sys.executable, "-m", "app.cli", "tour", "earth",
         "--date", "2026-06-01", "--depth", "1"],
        capture_output=True, text=True, timeout=120,
    )
    assert result.returncode == 0
    assert "Mars" in result.stdout
    assert "km/s" in result.stdout


def test_tour_shows_accuracy_note_for_far_dates():
    """Tour should print a friendly note for destinations arriving beyond 2050."""
    result = subprocess.run(
        [sys.executable, "-m", "app.cli", "tour", "earth",
         "--date", "2026-06-01", "--depth", "1"],
        capture_output=True, text=True, timeout=120,
    )
    assert result.returncode == 0
    # Should mention reduced accuracy with at least one planet name and year
    assert re.search(r"(?i)reduced.*accuracy.*\w+.*\d{4}", result.stdout)


def test_tour_out_of_range_shows_error():
    """Tour with a date beyond the cache range should fail with a clear message."""
    result = subprocess.run(
        [sys.executable, "-m", "app.cli", "tour", "mars",
         "--date", "2280-06-01", "--depth", "1"],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode != 0
    assert "2100" in result.stdout or "2100" in result.stderr


def test_tour_suppresses_erfa_warnings():
    """Raw ERFA warnings should not appear in stderr."""
    result = subprocess.run(
        [sys.executable, "-m", "app.cli", "tour", "earth",
         "--date", "2026-06-01", "--depth", "1"],
        capture_output=True, text=True, timeout=120,
    )
    assert "ErfaWarning" not in result.stderr
    assert "dubious year" not in result.stderr
