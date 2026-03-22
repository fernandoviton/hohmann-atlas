"""Generate the launch window cache file in batches.

Usage:
  # Generate a single batch (writes to data/windows_START_END.json):
  cd backend && python -m app.engine.generate_cache --start 2025-01-01 --end 2050-01-01

  # Merge all batch files into the final cache:
  cd backend && python -m app.engine.generate_cache --merge
"""

import argparse
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

_DATA_DIR = Path(__file__).parent / "data"

# Short field names used in the JSON cache.
# Legend is embedded in every file for self-documentation.
LEGEND = {
    "l": "launch date (ISO 8601)",
    "tt": "transfer time (days)",
    "dd": "departure delta-v (km/s)",
    "ad": "arrival delta-v (km/s)",
    "dv": "total delta-v (km/s)",
}


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
        "l": launch_date.iso[:10],
        "tt": round(transfer.transfer_time.to(u.day).value, 2),
        "dd": round(transfer.departure_dv.to(u.km / u.s).value, 4),
        "ad": round(transfer.arrival_dv.to(u.km / u.s).value, 4),
        "dv": round(transfer.delta_v_total.to(u.km / u.s).value, 4),
    }


def generate_pair(origin: str, destination: str,
                  start: str, end: str) -> list[dict]:
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
            if w["l"] >= end:
                break
            windows.append(w)
            cursor = Time(w["l"]) + TimeDelta(max(syn * 0.5, 30) * u.day)
        return windows


def generate_all(start: str, end: str) -> dict:
    """Generate windows for all 56 planet pairs."""
    result = {
        "gen": datetime.now(timezone.utc).isoformat(),
        "range": [start, end],
        "legend": LEGEND,
        "w": {},
    }
    total = len(PLANETS) * (len(PLANETS) - 1)
    done = 0
    for origin in PLANETS:
        for dest in PLANETS:
            if origin.name == dest.name:
                continue
            key = f"{origin.name.lower()}->{dest.name.lower()}"
            result["w"][key] = generate_pair(
                origin.name, dest.name, start, end)
            done += 1
            print(f"  [{done}/{total}] {key}: "
                  f"{len(result['w'][key])} windows")
    return result


def _batch_filename(start: str, end: str) -> str:
    """Return filename like windows_2025_2050.json."""
    return f"windows_{start[:4]}_{end[:4]}.json"


def generate_batch(start: str, end: str) -> None:
    """Generate one batch and write to data/windows_START_END.json."""
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = _DATA_DIR / _batch_filename(start, end)
    print(f"Generating batch {start} -> {end} ...")
    data = generate_all(start, end)
    path.write_text(json.dumps(data))
    print(f"Wrote {path} ({sum(len(v) for v in data['w'].values())} windows)")


def merge_batches() -> None:
    """Merge all windows_*_*.json batch files into the final windows.json."""
    batch_files = sorted(_DATA_DIR.glob("windows_*_*.json"))
    if not batch_files:
        print("No batch files found in", _DATA_DIR)
        return

    merged_windows: dict[str, list[dict]] = {}
    overall_start = None
    overall_end = None

    for bf in batch_files:
        print(f"  Loading {bf.name} ...")
        data = json.loads(bf.read_text())
        batch_start, batch_end = data["range"]
        if overall_start is None or batch_start < overall_start:
            overall_start = batch_start
        if overall_end is None or batch_end > overall_end:
            overall_end = batch_end
        for key, windows in data["w"].items():
            if key not in merged_windows:
                merged_windows[key] = []
            merged_windows[key].extend(windows)

    # Sort each pair's windows by launch date and deduplicate
    for key in merged_windows:
        seen = set()
        deduped = []
        for w in sorted(merged_windows[key], key=lambda w: w["l"]):
            if w["l"] not in seen:
                seen.add(w["l"])
                deduped.append(w)
        merged_windows[key] = deduped

    result = {
        "gen": datetime.now(timezone.utc).isoformat(),
        "range": [overall_start, overall_end],
        "legend": LEGEND,
        "w": merged_windows,
    }

    output = _DATA_DIR / "windows.json"
    output.write_text(json.dumps(result))
    total = sum(len(v) for v in merged_windows.values())
    print(f"Merged {len(batch_files)} batches -> {output} "
          f"({len(merged_windows)} pairs, {total} windows, "
          f"range {overall_start} to {overall_end})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate launch window cache")
    parser.add_argument("--start", help="Batch start date (YYYY-MM-DD)")
    parser.add_argument("--end", help="Batch end date (YYYY-MM-DD)")
    parser.add_argument("--merge", action="store_true",
                        help="Merge all batch files into windows.json")
    args = parser.parse_args()

    if args.merge:
        merge_batches()
    elif args.start and args.end:
        generate_batch(args.start, args.end)
    else:
        parser.error("provide --start and --end, or --merge")
