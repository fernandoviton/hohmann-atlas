"""Planetary ephemeris: real positions and phase angles."""

import numpy as np
import astropy.units as u
from astropy.coordinates import get_body, HeliocentricMeanEcliptic
from astropy.time import Time

from app.engine.bodies import get_planet
from app.engine.hohmann import compute_transfer


def heliocentric_longitude(body_name: str, time: Time) -> u.Quantity:
    """Get ecliptic longitude of a solar system body at a given time.

    Accepts a single Time or an array of Times (vectorized).
    """
    coord = get_body(body_name, time)
    ecl = coord.transform_to(HeliocentricMeanEcliptic())
    lon = ecl.lon.to(u.rad)
    return lon


def phase_angle(origin: str, destination: str, time: Time) -> u.Quantity:
    """Compute the phase angle from origin to destination, normalized to [0, 2π).

    Accepts a single Time or an array of Times (vectorized).
    """
    lon1 = heliocentric_longitude(origin, time)
    lon2 = heliocentric_longitude(destination, time)
    angle = ((lon2 - lon1) % (2 * np.pi * u.rad)).to(u.rad)
    return angle


def required_phase_angle(origin: str, destination: str) -> u.Quantity:
    """Compute the phase angle the destination must lead/trail the origin at departure.

    For the spacecraft to arrive at the destination's orbit at the same time as
    the destination planet, the planet must be at a specific angular offset at launch.
    θ = π - (transfer_time / T_dest) * 2π, normalized to [0, 2π).
    """
    transfer = compute_transfer(origin, destination)
    dest_planet = get_planet(destination)
    t_transfer = transfer.transfer_time.to(u.day)
    t_dest = dest_planet.orbital_period.to(u.day)

    theta = (np.pi * u.rad - (t_transfer / t_dest) * 2 * np.pi * u.rad)
    theta = (theta % (2 * np.pi * u.rad)).to(u.rad)
    return theta
