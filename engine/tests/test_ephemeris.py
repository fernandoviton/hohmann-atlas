import astropy.units as u
import numpy as np
import pytest
from astropy.time import Time

from app.engine.ephemeris import (
    heliocentric_longitude,
    phase_angle,
    required_phase_angle,
)


def test_heliocentric_longitude_returns_quantity():
    lon = heliocentric_longitude("earth", Time("2026-06-01"))
    assert lon.unit.is_equivalent(u.rad)


def test_heliocentric_longitude_range():
    """Longitude should be in [0, 2π)."""
    for body in ["mercury", "venus", "earth", "mars", "jupiter"]:
        lon = heliocentric_longitude(body, Time("2026-06-01"))
        assert 0 <= lon.to(u.rad).value < 2 * np.pi


def test_heliocentric_longitude_changes_over_time():
    """A planet should move appreciably over 6 months."""
    t1 = Time("2026-01-01")
    t2 = Time("2026-07-01")
    lon1 = heliocentric_longitude("earth", t1)
    lon2 = heliocentric_longitude("earth", t2)
    assert abs(lon2.to(u.rad).value - lon1.to(u.rad).value) > 0.5


def test_phase_angle_returns_quantity():
    pa = phase_angle("earth", "mars", Time("2026-06-01"))
    assert pa.unit.is_equivalent(u.rad)


def test_phase_angle_range():
    """Phase angle should be in [0, 2π)."""
    pa = phase_angle("earth", "mars", Time("2026-06-01"))
    assert 0 <= pa.to(u.rad).value < 2 * np.pi


def test_phase_angle_self_is_zero():
    """Phase angle from a planet to itself should be zero."""
    pa = phase_angle("earth", "earth", Time("2026-06-01"))
    assert abs(pa.to(u.rad).value) < 0.01


def test_phase_angle_complementary():
    """phase_angle(A, B) + phase_angle(B, A) should equal 2π (mod 2π)."""
    t = Time("2026-06-01")
    ab = phase_angle("earth", "mars", t).to(u.rad).value
    ba = phase_angle("mars", "earth", t).to(u.rad).value
    total = (ab + ba) % (2 * np.pi)
    # Should be ~0 or ~2π
    assert total < 0.01 or abs(total - 2 * np.pi) < 0.01


def test_required_phase_angle_earth_mars():
    """Required phase angle for Earth→Mars should be roughly 44° (0.77 rad)."""
    theta = required_phase_angle("earth", "mars")
    deg = theta.to(u.deg).value
    assert 30 < deg < 60, f"Earth→Mars required phase angle {deg:.1f}° out of range"


def test_required_phase_angle_returns_quantity():
    theta = required_phase_angle("earth", "mars")
    assert theta.unit.is_equivalent(u.rad)


def test_required_phase_angle_earth_venus():
    """Required phase angle for Earth→Venus (inner transfer) should be reasonable."""
    theta = required_phase_angle("earth", "venus")
    deg = theta.to(u.deg).value
    # Venus is inner, phase angle should be somewhere reasonable
    assert 0 < deg < 360
