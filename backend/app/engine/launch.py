"""Launch window finder using real planetary ephemeris."""

from dataclasses import dataclass

import astropy.units as u
import numpy as np
from astropy.time import Time, TimeDelta

from app.engine.bodies import get_planet
from app.engine.ephemeris import phase_angle, required_phase_angle
from app.engine.hohmann import compute_transfer
from app.engine.windows import synodic_period


@dataclass(frozen=True)
class LaunchWindow:
    origin: str
    destination: str
    launch_date: Time
    arrival_date: Time
    transfer_time: u.Quantity
    departure_dv: u.Quantity
    arrival_dv: u.Quantity
    delta_v_total: u.Quantity


def _phase_error_scalar(origin: str, destination: str, time: Time,
                        required: float) -> float:
    """Signed phase error in radians, wrapped to [-π, π). Single time only."""
    actual = phase_angle(origin, destination, time).to(u.rad).value
    diff = (actual - required) % (2 * np.pi)
    if diff > np.pi:
        diff -= 2 * np.pi
    return diff


def find_next_window(origin: str, destination: str, after: Time) -> LaunchWindow:
    """Find the next Hohmann transfer launch window after a given date.

    Computes phase angles for all days in one vectorized call, finds the
    zero-crossing, then refines with bisection.
    """
    transfer = compute_transfer(origin, destination)
    required = required_phase_angle(origin, destination).to(u.rad).value
    syn = synodic_period(origin, destination).to(u.day).value
    search_days = int(np.ceil(syn)) + 1

    # Vectorized: compute phase angles for all days at once
    times = after + TimeDelta(np.arange(search_days + 1) * u.day)
    angles = phase_angle(origin, destination, times).to(u.rad).value

    # Compute signed phase error for all days
    errors = (angles - required) % (2 * np.pi)
    errors[errors > np.pi] -= 2 * np.pi

    # Find first sign change (excluding wrapping artifacts)
    for i in range(len(errors) - 1):
        if errors[i] * errors[i + 1] <= 0 and abs(errors[i]) < np.pi:
            launch_date = _bisect(origin, destination,
                                  times[i], times[i + 1], required)
            return _build_window(origin, destination, launch_date, transfer)

    # Fallback: minimum absolute error
    best_idx = int(np.argmin(np.abs(errors)))
    return _build_window(origin, destination, times[best_idx], transfer)


def _bisect(origin: str, destination: str,
            t_lo: Time, t_hi: Time, required: float,
            tol_days: float = 0.1) -> Time:
    """Bisection search between two times to find zero-crossing of phase error."""
    for _ in range(30):  # plenty of iterations for sub-hour precision
        dt = (t_hi - t_lo).to(u.day).value
        if dt < tol_days:
            break
        t_mid = t_lo + TimeDelta(dt / 2 * u.day)
        err_lo = _phase_error_scalar(origin, destination, t_lo, required)
        err_mid = _phase_error_scalar(origin, destination, t_mid, required)
        if err_lo * err_mid <= 0:
            t_hi = t_mid
        else:
            t_lo = t_mid
    return t_lo + TimeDelta((t_hi - t_lo).to(u.day) / 2)


def _build_window(origin: str, destination: str,
                  launch_date: Time, transfer) -> LaunchWindow:
    """Construct a LaunchWindow from a launch date and precomputed transfer."""
    arrival_date = launch_date + TimeDelta(transfer.transfer_time)
    return LaunchWindow(
        origin=transfer.origin,
        destination=transfer.destination,
        launch_date=launch_date,
        arrival_date=arrival_date,
        transfer_time=transfer.transfer_time,
        departure_dv=transfer.departure_dv,
        arrival_dv=transfer.arrival_dv,
        delta_v_total=transfer.delta_v_total,
    )
