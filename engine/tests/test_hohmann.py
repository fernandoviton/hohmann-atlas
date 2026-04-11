import astropy.units as u
import pytest

from app.engine.hohmann import compute_transfer


def test_earth_to_mars_delta_v():
    t = compute_transfer("Earth", "Mars")
    dv = t.delta_v_total.to(u.km / u.s).value
    assert 5.0 < dv < 6.5, f"Earth→Mars delta-v {dv:.2f} km/s out of range"


def test_earth_to_mars_transfer_time():
    t = compute_transfer("Earth", "Mars")
    days = t.transfer_time.to(u.day).value
    assert 250 < days < 270, f"Earth→Mars transfer {days:.0f} days out of range"


def test_mars_to_jupiter():
    t = compute_transfer("Mars", "Jupiter")
    dv = t.delta_v_total.to(u.km / u.s).value
    assert 9.0 < dv < 11.5, f"Mars→Jupiter delta-v {dv:.2f} km/s out of range"
    years = t.transfer_time.to(u.year).value
    assert 2.5 < years < 3.5, f"Mars→Jupiter transfer {years:.1f} years out of range"


def test_earth_to_venus():
    t = compute_transfer("Earth", "Venus")
    dv = t.delta_v_total.to(u.km / u.s).value
    assert 4.5 < dv < 6.0, f"Earth→Venus delta-v {dv:.2f} km/s out of range"
    days = t.transfer_time.to(u.day).value
    assert 130 < days < 160, f"Earth→Venus transfer {days:.0f} days out of range"


def test_symmetry():
    ab = compute_transfer("Earth", "Mars")
    ba = compute_transfer("Mars", "Earth")
    assert abs(ab.delta_v_total.value - ba.delta_v_total.value) < 0.01


def test_departure_and_arrival_dv_sum():
    t = compute_transfer("Earth", "Mars")
    total = (t.departure_dv + t.arrival_dv).to(u.km / u.s).value
    assert abs(total - t.delta_v_total.to(u.km / u.s).value) < 0.01


def test_same_planet_raises():
    with pytest.raises(ValueError):
        compute_transfer("Earth", "Earth")
