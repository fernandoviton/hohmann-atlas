"""Multi-hop tour planner: find transfer options and chain them."""

from dataclasses import dataclass
from typing import Callable

import astropy.units as u
from astropy.time import Time

from app.engine.bodies import PLANETS
from app.engine.cache import cache_date_range
from app.engine.launch import LaunchWindow, find_next_window

# on_progress(depth, origin, destination, local_index, local_total)
ProgressCallback = Callable[[int, str, str, int, int], None]


@dataclass(frozen=True)
class TourOption:
    window: LaunchWindow
    wait_time: u.Quantity  # time waiting before launch
    next_options: tuple  # tuple[TourOption, ...], empty if leaf


@dataclass(frozen=True)
class TourNode:
    origin: str
    start_date: Time
    options: tuple  # tuple[TourOption, ...]


def _count_windows(depth: int, n_planets: int = len(PLANETS)) -> int:
    """Total number of window searches across all depths.

    At each level, we exclude the current planet, giving (n_planets - 1) destinations.
    Each destination then has (n_planets - 1) sub-destinations (excluding itself).
    """
    n_dest = n_planets - 1
    if depth <= 1:
        return n_dest
    return n_dest + n_dest * _count_windows(depth - 1, n_planets)


def plan_tour(origin: str, start_date: Time, depth: int = 2,
              on_progress: ProgressCallback | None = None) -> TourNode:
    """Plan a multi-hop tour from origin at start_date.

    Args:
        origin: Starting planet name.
        start_date: Earliest departure date.
        depth: How many hops to compute (1 = direct only, 2 = one relay, etc.).
        on_progress: Optional callback(depth, origin, dest, local_i, local_total).

    Returns:
        TourNode with options for each reachable destination, each containing
        nested next_options if depth > 1.
    """
    start_iso = start_date.iso[:10]
    cache_start, cache_end = cache_date_range()
    if start_iso >= cache_end:
        raise ValueError(
            f"Start date {start_iso} is beyond the cache range. "
            f"Cache covers {cache_start} to {cache_end}."
        )

    max_depth = depth
    options = _find_options(origin, start_date, depth, max_depth, on_progress)

    if not options:
        raise ValueError(
            f"No launch windows found for {origin} after {start_iso}. "
            f"Cache covers {cache_start} to {cache_end}."
        )

    return TourNode(
        origin=options[0].window.origin if options else origin,
        start_date=start_date,
        options=tuple(options),
    )


def _find_options(origin: str, after: Time, depth: int, max_depth: int,
                  on_progress: ProgressCallback | None) -> list[TourOption]:
    """Find all transfer options from origin after a given date."""
    destinations = [p for p in PLANETS if p.name.lower() != origin.lower()]
    hop_level = max_depth - depth + 1
    options = []
    for i, planet in enumerate(destinations, 1):
        try:
            window = find_next_window(origin, planet.name, after)
        except ValueError:
            continue  # no cached window available for this pair/date
        wait_time = (window.launch_date - after).to(u.day)

        if on_progress:
            on_progress(hop_level, origin.capitalize(), planet.name, i, len(destinations))

        if depth > 1:
            next_opts = _find_options(
                window.destination, window.arrival_date, depth - 1,
                max_depth, on_progress,
            )
        else:
            next_opts = []

        options.append(TourOption(
            window=window,
            wait_time=wait_time,
            next_options=tuple(next_opts),
        ))
    return options
