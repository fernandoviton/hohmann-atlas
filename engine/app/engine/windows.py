import astropy.units as u

from app.engine.bodies import get_planet


def synodic_period(planet_a: str, planet_b: str) -> u.Quantity:
    """Compute the synodic period between two planets: T_syn = 1 / |1/T1 - 1/T2|."""
    t1 = get_planet(planet_a).orbital_period.to(u.day)
    t2 = get_planet(planet_b).orbital_period.to(u.day)
    return (1 / abs(1 / t1 - 1 / t2)).to(u.day)
