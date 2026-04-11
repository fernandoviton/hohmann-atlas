from dataclasses import dataclass

import astropy.units as u
import numpy as np
from astropy.constants import GM_sun

from app.engine.bodies import get_planet


@dataclass(frozen=True)
class TransferResult:
    origin: str
    destination: str
    departure_dv: u.Quantity
    arrival_dv: u.Quantity
    delta_v_total: u.Quantity
    transfer_time: u.Quantity


def compute_transfer(origin: str, destination: str) -> TransferResult:
    p1 = get_planet(origin)
    p2 = get_planet(destination)

    if p1.name == p2.name:
        raise ValueError(f"Origin and destination are the same: {p1.name}")

    r1 = p1.semi_major_axis.to(u.m)
    r2 = p2.semi_major_axis.to(u.m)
    mu = GM_sun.to(u.m**3 / u.s**2)

    # Semi-major axis of the transfer ellipse
    a_transfer = (r1 + r2) / 2

    # Vis-viva: v = sqrt(mu * (2/r - 1/a))
    # Circular orbital velocities
    v_circ_1 = np.sqrt(mu / r1).to(u.km / u.s)
    v_circ_2 = np.sqrt(mu / r2).to(u.km / u.s)

    # Velocities on the transfer orbit at departure and arrival
    v_transfer_dep = np.sqrt(mu * (2 / r1 - 1 / a_transfer)).to(u.km / u.s)
    v_transfer_arr = np.sqrt(mu * (2 / r2 - 1 / a_transfer)).to(u.km / u.s)

    departure_dv = abs(v_transfer_dep - v_circ_1)
    arrival_dv = abs(v_transfer_arr - v_circ_2)
    delta_v_total = departure_dv + arrival_dv

    # Transfer time = half the orbital period of the transfer ellipse
    transfer_time = (np.pi * np.sqrt(a_transfer**3 / mu)).to(u.day)

    return TransferResult(
        origin=p1.name,
        destination=p2.name,
        departure_dv=departure_dv,
        arrival_dv=arrival_dv,
        delta_v_total=delta_v_total,
        transfer_time=transfer_time,
    )
