import argparse
import sys
import warnings

import astropy.units as u
from astropy.time import Time
from erfa import ErfaWarning
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, MofNCompleteColumn
from rich.table import Table

from app.engine.bodies import PLANETS, get_planet
from app.engine.hohmann import compute_transfer
from app.engine.tour import plan_tour
from app.engine.windows import synodic_period

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


def _transfer_command(args, console: Console) -> None:
    try:
        origin = get_planet(args.planet)
    except ValueError:
        console.print(f"[red]Unknown planet: {args.planet}[/red]")
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

        table.add_row(
            dest.name,
            f"{t.departure_dv.to(u.km / u.s).value:.2f} km/s",
            f"{t.arrival_dv.to(u.km / u.s).value:.2f} km/s",
            f"[{color}]{dv_total:.2f} km/s[/{color}]",
            _format_days(t.transfer_time.to(u.day).value),
            _format_days(syn.to(u.day).value),
        )

    console.print(table)


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
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            MofNCompleteColumn(),
            console=console,
        ) as progress:
            tasks = {}  # depth_level -> progress task_id

            def on_progress(hop_level, origin, dest, i, total):
                # Create or update progress task for this hop level
                if hop_level not in tasks:
                    tasks[hop_level] = progress.add_task("", total=total)
                # Remove deeper levels when we move back up
                for old_level in [k for k in tasks if k > hop_level]:
                    progress.remove_task(tasks.pop(old_level))
                prefix = "  " * (hop_level - 1)
                label = f"{prefix}Hop {hop_level}: {origin} -> {dest}"
                progress.update(tasks[hop_level], completed=i, total=total,
                                description=label)

            node = plan_tour(args.planet, start_date, depth=args.depth,
                             on_progress=on_progress)

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
        description="Planetary Hohmann transfer calculator",
    )
    subparsers = parser.add_subparsers(dest="command")

    # Transfer subcommand
    transfer_parser = subparsers.add_parser(
        "transfer", help="Show Hohmann transfers from a planet"
    )
    transfer_parser.add_argument("planet", help="Origin planet")

    # Tour subcommand
    tour_parser = subparsers.add_parser(
        "tour", help="Plan a multi-hop tour with launch windows"
    )
    tour_parser.add_argument("planet", help="Starting planet")
    tour_parser.add_argument(
        "--date", required=True, help="Start date (ISO format, e.g. 2026-06-01)"
    )
    tour_parser.add_argument(
        "--depth", type=int, default=2, help="Number of hops to compute (default: 2)"
    )

    # Backward compat: if first arg is not a subcommand, treat as planet name
    if len(sys.argv) > 1 and sys.argv[1] not in ("transfer", "tour", "-h", "--help"):
        sys.argv.insert(1, "transfer")

    args = parser.parse_args()

    if args.command == "transfer":
        _transfer_command(args, console)
    elif args.command == "tour":
        _tour_command(args, console)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
