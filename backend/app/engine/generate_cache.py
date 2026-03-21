"""Generate the launch window cache file.

Usage: cd backend && python -m app.engine.generate_cache
"""

import json
import warnings
from datetime import datetime, timezone
from pathlib import Path

import astropy.units as u
import numpy as np
from astropy.time import Time, TimeDelta
from erfa import ErfaWarning

from app.engine.bodies import PLANETS
from app.engine.ephemeris import phase_angle, required_phase_angle
from app.engine.hohmann import compute_transfer
from app.engine.windows import synodic_period

OUTPUT_PATH = Path(__file__).parent / "data" / "windows.json"
START = "2025-01-01"
END = "2100-01-01"


def _phase_error_scalar(origin: str, destination: str, time: Time,
                        required: float) -> float:
    actual = phase_angle(origin, destination, time).to(u.rad).value
    diff = (actual - required) % (2 * np.pi)
    if diff > np.pi:
        diff -= 2 * np.pi
    return diff


def _bisect(origin: str, destination: str,
            t_lo: Time, t_hi: Time, required: float,
            tol_days: float = 0.1) -> Time:
    for _ in range(30):
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


def _find_window_ephemeris(origin: str, destination: str, after: Time,
                           transfer, syn: float, required: float) -> dict | None:
    """Find next launch window using ephemeris. Returns dict or None."""
    search_days = int(np.ceil(syn)) + 1
    times = after + TimeDelta(np.arange(search_days + 1) * u.day)
    angles = phase_angle(origin, destination, times).to(u.rad).value

    errors = (angles - required) % (2 * np.pi)
    errors[errors > np.pi] -= 2 * np.pi

    for i in range(len(errors) - 1):
        if errors[i] * errors[i + 1] <= 0 and abs(errors[i]) < np.pi:
            launch_date = _bisect(origin, destination,
                                  times[i], times[i + 1], required)
            return _to_dict(launch_date, transfer)

    best_idx = int(np.argmin(np.abs(errors)))
    return _to_dict(times[best_idx], transfer)


def _to_dict(launch_date: Time, transfer) -> dict:
    return {
        "launch": launch_date.iso[:10],
        "transfer_time_days": round(transfer.transfer_time.to(u.day).value, 2),
        "departure_dv_km_s": round(transfer.departure_dv.to(u.km / u.s).value, 4),
        "arrival_dv_km_s": round(transfer.arrival_dv.to(u.km / u.s).value, 4),
        "delta_v_total_km_s": round(transfer.delta_v_total.to(u.km / u.s).value, 4),
    }


def generate_pair(origin: str, destination: str,
                  start: str = START, end: str = END) -> list[dict]:
    """Generate all launch windows for one planet pair over the date range."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", ErfaWarning)
        transfer = compute_transfer(origin, destination)
        syn = synodic_period(origin, destination).to(u.day).value
        required = required_phase_angle(origin, destination).to(u.rad).value

        windows = []
        cursor = Time(start)
        end_time = Time(end)
        while cursor < end_time:
            w = _find_window_ephemeris(origin, destination, cursor,
                                       transfer, syn, required)
            if w is None:
                break
            if w["launch"] >= end:
                break
            windows.append(w)
            # Jump past this window by half a synodic period
            cursor = Time(w["launch"]) + TimeDelta(max(syn * 0.5, 30) * u.day)
        return windows


def generate_all(start: str = START, end: str = END) -> dict:
    """Generate windows for all 56 planet pairs."""
    result = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "range": [start, end],
        "windows": {},
    }
    total = len(PLANETS) * (len(PLANETS) - 1)
    done = 0
    for origin in PLANETS:
        for dest in PLANETS:
            if origin.name == dest.name:
                continue
            key = f"{origin.name.lower()}->{dest.name.lower()}"
            result["windows"][key] = generate_pair(
                origin.name, dest.name, start, end)
            done += 1
            print(f"  [{done}/{total}] {key}: "
                  f"{len(result['windows'][key])} windows")
    return result


def generate_and_write(output_path: str | None = None,
                       start: str = START, end: str = END) -> None:
    path = Path(output_path) if output_path else OUTPUT_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    data = generate_all(start, end)
    path.write_text(json.dumps(data, indent=2))
    print(f"Wrote {path}")


if __name__ == "__main__":
    generate_and_write()
