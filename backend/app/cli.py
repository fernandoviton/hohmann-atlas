import sys

import astropy.units as u
from rich.console import Console
from rich.table import Table

from app.engine.bodies import PLANETS, get_planet
from app.engine.hohmann import compute_transfer
from app.engine.windows import synodic_period


def _dv_color(dv_km_s: float) -> str:
    if dv_km_s < 6:
        return "green"
    if dv_km_s < 10:
        return "yellow"
    return "red"


def main() -> None:
    console = Console()

    if len(sys.argv) > 1:
        origin_name = sys.argv[1]
    else:
        console.print("Usage: hohmann-atlas <planet>", style="bold")
        console.print("Planets:", ", ".join(p.name for p in PLANETS))
        sys.exit(1)

    try:
        origin = get_planet(origin_name)
    except ValueError:
        console.print(f"[red]Unknown planet: {origin_name}[/red]")
        sys.exit(1)

    table = Table(title=f"Hohmann Transfers from {origin.name}")
    table.add_column("Destination", style="cyan")
    table.add_column("Departure dv", justify="right")
    table.add_column("Arrival dv", justify="right")
    table.add_column("Total dv", justify="right")
    table.add_column("Transfer Time", justify="right")
    table.add_column("Synodic Period", justify="right")

    for dest in PLANETS:
        if dest.name == origin.name:
            continue

        t = compute_transfer(origin.name, dest.name)
        syn = synodic_period(origin.name, dest.name)

        dv_total = t.delta_v_total.to(u.km / u.s).value
        color = _dv_color(dv_total)

        transfer_days = t.transfer_time.to(u.day).value
        if transfer_days > 365.25:
            time_str = f"{transfer_days / 365.25:.1f} yr"
        else:
            time_str = f"{transfer_days:.0f} d"

        syn_days = syn.to(u.day).value
        if syn_days > 365.25:
            syn_str = f"{syn_days / 365.25:.1f} yr"
        else:
            syn_str = f"{syn_days:.0f} d"

        table.add_row(
            dest.name,
            f"{t.departure_dv.to(u.km / u.s).value:.2f} km/s",
            f"{t.arrival_dv.to(u.km / u.s).value:.2f} km/s",
            f"[{color}]{dv_total:.2f} km/s[/{color}]",
            time_str,
            syn_str,
        )

    console.print(table)
