import astropy.units as u
import pytest
from astropy.time import Time

from app.engine.launch import LaunchWindow, find_next_window


def test_find_next_window_returns_launch_window():
    w = find_next_window("earth", "mars", Time("2026-06-01"))
    assert isinstance(w, LaunchWindow)


def test_launch_window_fields():
    w = find_next_window("earth", "mars", Time("2026-06-01"))
    assert w.origin == "Earth"
    assert w.destination == "Mars"
    assert w.launch_date > Time("2026-06-01")
    assert w.arrival_date > w.launch_date
    assert w.transfer_time.unit.is_equivalent(u.day)
    assert w.delta_v_total.unit.is_equivalent(u.km / u.s)


def test_earth_mars_window_plausible_date():
    """Earth→Mars windows recur every ~26 months.  From June 2026 the next
    window should be within ~2 years."""
    w = find_next_window("earth", "mars", Time("2026-06-01"))
    launch_year = w.launch_date.datetime.year
    assert 2026 <= launch_year <= 2028


def test_earth_mars_transfer_time():
    """Transfer time should be ~259 days (Hohmann)."""
    w = find_next_window("earth", "mars", Time("2026-06-01"))
    days = w.transfer_time.to(u.day).value
    assert 250 < days < 270


def test_earth_mars_delta_v():
    """Delta-v should match the standard Hohmann value."""
    w = find_next_window("earth", "mars", Time("2026-06-01"))
    dv = w.delta_v_total.to(u.km / u.s).value
    assert 5.0 < dv < 6.5


def test_arrival_date_equals_launch_plus_transfer():
    w = find_next_window("earth", "mars", Time("2026-06-01"))
    expected_arrival = w.launch_date + w.transfer_time
    diff = abs((w.arrival_date - expected_arrival).to(u.day).value)
    assert diff < 1.0  # within 1 day


def test_inner_transfer_earth_venus():
    """Should also work for transfers to inner planets."""
    w = find_next_window("earth", "venus", Time("2026-06-01"))
    assert w.destination == "Venus"
    days = w.transfer_time.to(u.day).value
    assert 130 < days < 160


def test_mars_jupiter_window():
    """Mars→Jupiter window should be findable."""
    w = find_next_window("mars", "jupiter", Time("2026-06-01"))
    assert w.destination == "Jupiter"
    years = w.transfer_time.to(u.year).value
    assert 2.5 < years < 3.5


def test_year_2500_raises():
    """Dates far beyond the cache range (2025–2100) must fail clearly."""
    with pytest.raises(ValueError, match=r"Cache covers 2025-01-01 to 2100-01-01"):
        find_next_window("earth", "mars", Time("2500-01-01"))


def test_near_end_of_range_raises():
    """A date within the cache era but close enough to the end that no
    window remains should also fail with a clear error."""
    with pytest.raises(ValueError, match=r"Cache covers 2025-01-01 to 2100-01-01"):
        find_next_window("earth", "mars", Time("2099-12-01"))


def test_frozen_dataclass():
    w = find_next_window("earth", "mars", Time("2026-06-01"))
    with pytest.raises(AttributeError):
        w.origin = "Venus"
