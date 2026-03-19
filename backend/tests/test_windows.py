import astropy.units as u

from app.engine.windows import synodic_period


def test_earth_mars_synodic():
    period = synodic_period("Earth", "Mars")
    days = period.to(u.day).value
    assert 770 < days < 790, f"Earth–Mars synodic {days:.0f} days out of range"


def test_mars_jupiter_synodic():
    period = synodic_period("Mars", "Jupiter")
    days = period.to(u.day).value
    assert 800 < days < 830, f"Mars–Jupiter synodic {days:.0f} days out of range"


def test_symmetry():
    ab = synodic_period("Earth", "Mars").to(u.day).value
    ba = synodic_period("Mars", "Earth").to(u.day).value
    assert abs(ab - ba) < 0.01
