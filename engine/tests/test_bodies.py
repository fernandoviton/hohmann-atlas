import astropy.units as u

from app.engine.bodies import PLANETS, get_planet


def test_all_eight_planets_registered():
    names = [p.name for p in PLANETS]
    assert names == [
        "Mercury", "Venus", "Earth", "Mars",
        "Jupiter", "Saturn", "Uranus", "Neptune",
    ]


def test_radii_in_au():
    for planet in PLANETS:
        assert planet.semi_major_axis.unit == u.AU
        assert planet.semi_major_axis.value > 0


def test_periods_in_days():
    for planet in PLANETS:
        assert planet.orbital_period.unit == u.day
        assert planet.orbital_period.value > 0


def test_get_planet_by_name():
    earth = get_planet("Earth")
    assert earth.name == "Earth"
    assert abs(earth.semi_major_axis.value - 1.0) < 0.01


def test_get_planet_case_insensitive():
    assert get_planet("mars").name == "Mars"


def test_earth_orbital_period():
    earth = get_planet("Earth")
    assert abs(earth.orbital_period.to(u.year).value - 1.0) < 0.01


def test_ordering_by_distance():
    radii = [p.semi_major_axis.value for p in PLANETS]
    assert radii == sorted(radii)
