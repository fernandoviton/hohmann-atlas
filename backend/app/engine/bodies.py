from dataclasses import dataclass

import astropy.units as u
from astropy.constants import GM_sun
import numpy as np


@dataclass(frozen=True)
class Planet:
    name: str
    semi_major_axis: u.Quantity
    orbital_period: u.Quantity


def _period_from_radius(a: u.Quantity) -> u.Quantity:
    """Kepler's third law: T = 2π √(a³ / GM)."""
    return (2 * np.pi * np.sqrt(a**3 / GM_sun)).to(u.day)


# Mean semi-major axes (IAU / NASA fact sheets)
PLANETS = [
    Planet("Mercury", 0.3871 * u.AU, _period_from_radius(0.3871 * u.AU)),
    Planet("Venus",   0.7233 * u.AU, _period_from_radius(0.7233 * u.AU)),
    Planet("Earth",   1.0000 * u.AU, _period_from_radius(1.0000 * u.AU)),
    Planet("Mars",    1.5237 * u.AU, _period_from_radius(1.5237 * u.AU)),
    Planet("Jupiter", 5.2034 * u.AU, _period_from_radius(5.2034 * u.AU)),
    Planet("Saturn",  9.5371 * u.AU, _period_from_radius(9.5371 * u.AU)),
    Planet("Uranus", 19.1913 * u.AU, _period_from_radius(19.1913 * u.AU)),
    Planet("Neptune",30.0690 * u.AU, _period_from_radius(30.0690 * u.AU)),
]

_LOOKUP = {p.name.lower(): p for p in PLANETS}


def get_planet(name: str) -> Planet:
    key = name.strip().lower()
    if key not in _LOOKUP:
        raise ValueError(f"Unknown planet: {name}")
    return _LOOKUP[key]
