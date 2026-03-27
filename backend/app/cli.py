import argparse
import sys
import warnings

import astropy.units as u
from astropy.time import Time
from erfa import ErfaWarning
from rich.console import Console
from rich.table import Table

from app.engine.bodies import PLANETS, get_planet
from app.engine.tour import plan_tour

_ERFA_ACCURACY_YEAR = 2050


def _dv_color(dv_km_s: float) -> str:
    if dv_km_s < 6:
        return "green"
    if dv_km_s < 10:
        return "yellow"
    return "red"


def _format_days(days: float) -> str:
    if days > 365.25:
        return f"{days / 365.25:.1f} yr"
    return f"{days:.0f} d"


def _tour_command(args, console: Console) -> None:
    try:
        get_planet(args.planet)
    except ValueError:
        console.print(f"[red]Unknown planet: {args.planet}[/red]")
        sys.exit(1)

    start_date = Time(args.date)
    console.print(
        f"[bold]Tour from {args.planet.capitalize()} "
        f"starting {args.date} (depth {args.depth})[/bold]\n"
    )
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", ErfaWarning)
        try:
            node = plan_tour(args.planet, start_date, depth=args.depth)
        except ValueError as exc:
            console.print(f"[red]{exc}[/red]")
            sys.exit(1)

        _print_tour_options(console, node.options, indent=0)
        _print_accuracy_note(console, node.options)


def _print_tour_options(console: Console, options, indent: int) -> None:
    prefix = "  " * indent

    table = Table(show_header=(indent == 0))
    if indent == 0:
        table.add_column("Destination", style="cyan")
        table.add_column("Wait", justify="right")
        table.add_column("Launch", justify="right")
        table.add_column("Transfer", justify="right")
        table.add_column("Arrival", justify="right")
        table.add_column("Total dv", justify="right")

    for opt in sorted(options, key=lambda o: o.wait_time.to(u.day).value):
        w = opt.window
        dv = w.delta_v_total.to(u.km / u.s).value
        color = _dv_color(dv)

        table.add_row(
            f"{prefix}{w.destination}",
            _format_days(opt.wait_time.to(u.day).value),
            w.launch_date.iso[:10],
            _format_days(w.transfer_time.to(u.day).value),
            w.arrival_date.iso[:10],
            f"[{color}]{dv:.2f} km/s[/{color}]",
        )

    console.print(table)

    # Print nested options
    for opt in sorted(options, key=lambda o: o.wait_time.to(u.day).value):
        if opt.next_options:
            console.print(
                f"\n{prefix}[bold cyan]From {opt.window.destination} "
                f"(arriving {opt.window.arrival_date.iso[:10]}):[/bold cyan]"
            )
            _print_tour_options(console, opt.next_options, indent + 1)


def _collect_far_arrivals(options, result: list) -> None:
    """Recursively collect (destination, year) for arrivals beyond the ERFA accuracy cutoff."""
    for opt in options:
        year = opt.window.arrival_date.datetime.year
        if year >= _ERFA_ACCURACY_YEAR:
            result.append((opt.window.destination, year))
        if opt.next_options:
            _collect_far_arrivals(opt.next_options, result)


def _print_accuracy_note(console: Console, options) -> None:
    far = []
    _collect_far_arrivals(options, far)
    if far:
        details = ", ".join(f"{name} ({year})" for name, year in far)
        console.print(
            f"\n[dim]Note: Reduced ephemeris accuracy for: {details}[/dim]"
        )


def main() -> None:
    console = Console()

    parser = argparse.ArgumentParser(
        prog="hohmann-atlas",
        description="Planetary Hohmann transfer tour planner",
    )
    parser.add_argument("planet", help="Starting planet")
    parser.add_argument(
        "--date", required=True, help="Start date (ISO format, e.g. 2026-06-01)"
    )
    parser.add_argument(
        "--depth", type=int, default=1, help="Number of hops to compute (default: 1)"
    )

    args = parser.parse_args()
    _tour_command(args, console)


if __name__ == "__main__":
    main()
