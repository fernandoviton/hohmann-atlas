"""Launch window finder using precomputed cache."""

from dataclasses import dataclass

import astropy.units as u
from astropy.time import Time, TimeDelta

from app.engine.cache import lookup_window
from app.engine.hohmann import compute_transfer


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


def find_next_window(origin: str, destination: str, after: Time) -> LaunchWindow:
    """Find the next Hohmann transfer launch window after a given date.

    Looks up the precomputed cache. To regenerate:
        cd backend && python -m app.engine.generate_cache
    """
    after_iso = after.iso[:10]
    entry = lookup_window(origin, destination, after_iso)
    if entry is None:
        raise ValueError(
            f"No cached window for {origin}->{destination} after {after_iso}. "
            "Regenerate with: cd backend && python -m app.engine.generate_cache"
        )

    transfer = compute_transfer(origin, destination)
    launch_date = Time(entry["launch"])
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
