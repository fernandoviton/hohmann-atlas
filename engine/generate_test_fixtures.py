"""Generate golden test fixtures from the Python engine for JS cross-validation.

Usage:
  cd engine && python generate_test_fixtures.py

Outputs JSON files to frontend/test-fixtures/.
"""

import json
import warnings
from pathlib import Path

import astropy.units as u
from astropy.time import Time, TimeDelta
from erfa import ErfaWarning

from app.engine.bodies import PLANETS
from app.engine.cache import load_cache, lookup_window, cache_date_range
from app.engine.ephemeris import heliocentric_longitude

warnings.filterwarnings("ignore", category=ErfaWarning)

_OUT_DIR = Path(__file__).resolve().parent.parent / "frontend" / "test-fixtures"


def _generate_planets_fixture():
    """Same format as /api/planets."""
    return [
        {
            "name": p.name,
            "semi_major_axis_au": round(p.semi_major_axis.to(u.AU).value, 4),
            "orbital_period_days": round(p.orbital_period.to(u.day).value, 4),
        }
        for p in PLANETS
    ]


def _generate_window_fixtures():
    """Window lookups for several origin/dest/date combos."""
    cases = [
        ("earth", "mars", "2026-06-01"),
        ("earth", "jupiter", "2026-06-01"),
        ("mars", "earth", "2027-01-01"),
        ("venus", "saturn", "2030-01-01"),
        ("earth", "venus", "2026-06-01"),
        ("jupiter", "neptune", "2050-01-01"),
    ]
    results = []
    for origin, dest, after in cases:
        entry = lookup_window(origin, dest, after)
        if entry is not None:
            results.append({
                "origin": origin,
                "destination": dest,
                "after": after,
                "expected": entry,
            })
    return results


def _build_tour(origin_name, start_iso, depth):
    """Build a tour using cache data only (matching JS implementation).

    Uses cache transfer_time_days for arrival dates, not Hohmann recomputation.
    """
    cache_start, cache_end = cache_date_range()

    def find_options(origin, after_iso, d):
        destinations = [p for p in PLANETS if p.name.lower() != origin.lower()]
        options = []
        for planet in destinations:
            entry = lookup_window(origin, planet.name, after_iso)
            if entry is None:
                continue
            launch_date = entry["launch"]
            transfer_days = entry["transfer_time_days"]
            # Arrival = launch + transfer_time from cache
            arrival_dt = Time(launch_date) + TimeDelta(transfer_days * u.day)
            arrival_date = arrival_dt.iso[:10]

            # Wait = launch - after
            wait_days = (Time(launch_date) - Time(after_iso)).to(u.day).value

            window = {
                "origin": origin.capitalize(),
                "destination": planet.name,
                "launch_date": launch_date,
                "arrival_date": arrival_date,
                "transfer_time_days": transfer_days,
                "departure_dv_km_s": entry["departure_dv_km_s"],
                "arrival_dv_km_s": entry["arrival_dv_km_s"],
                "delta_v_total_km_s": entry["delta_v_total_km_s"],
            }

            next_options = []
            if d > 1:
                next_options = find_options(planet.name, arrival_date, d - 1)

            options.append({
                "window": window,
                "wait_time_days": round(wait_days, 4),
                "next_options": next_options,
            })
        return options

    options = find_options(origin_name, start_iso, depth)
    return {
        "origin": origin_name.capitalize(),
        "start_date": start_iso,
        "options": options,
    }


def _generate_tour_fixtures():
    """Tour plans for several origins/dates/depths."""
    cases = [
        ("Earth", "2026-06-01", 1),
        ("Earth", "2026-06-01", 2),
        ("Mars", "2027-01-01", 1),
    ]
    results = []
    for origin, date, depth in cases:
        tour = _build_tour(origin, date, depth)
        results.append({
            "origin": origin,
            "start_date": date,
            "depth": depth,
            "expected": tour,
        })
    return results


def _generate_position_fixtures():
    """Heliocentric longitudes for all planets at several dates."""
    dates = ["2026-06-01", "2030-01-01", "2100-06-15"]
    results = []
    for date_str in dates:
        t = Time(date_str)
        positions = []
        for p in PLANETS:
            lon = heliocentric_longitude(p.name, t).to(u.rad).value
            positions.append({
                "name": p.name,
                "longitude_rad": round(lon, 4),
            })
        results.append({
            "date": date_str,
            "positions": positions,
        })
    return results


def main():
    _OUT_DIR.mkdir(parents=True, exist_ok=True)

    fixtures = {
        "planets.json": _generate_planets_fixture(),
        "windows.json": _generate_window_fixtures(),
        "tours.json": _generate_tour_fixtures(),
        "positions.json": _generate_position_fixtures(),
    }

    for name, data in fixtures.items():
        path = _OUT_DIR / name
        path.write_text(json.dumps(data, indent=2) + "\n")
        print(f"Wrote {path}")


if __name__ == "__main__":
    main()
