# Hohmann Atlas

Planetary-tour mission planner using real orbital mechanics. Computes Hohmann transfer orbits between any two planets in the solar system, including delta-v budgets, transfer times, and launch window (synodic) periods.

## Install

```bash
cd backend
python -m venv .venv

# Activate the venv
# Linux/macOS/Windows (bash):
source .venv/bin/activate
# Windows (cmd/PowerShell):
.venv\Scripts\activate

pip install -e ".[dev]"
```

## Usage

### CLI

```bash
hohmann-atlas Mars
```

Prints a table of all Hohmann transfers from the given origin planet, showing departure/arrival delta-v, total delta-v, transfer time, and synodic period.

### Web UI

```bash
hohmann-serve
```

Opens a web server at http://127.0.0.1:8000 with an interactive orbit visualization. Select an origin planet to see animated Hohmann transfer arcs on a solar system diagram, with a color-coded campaign table showing delta-v budgets, transfer times, and synodic periods.

## Example Output
(as of commit bf2d76e)

```
                               Hohmann Transfers from Mars
┏━━━━━━━━━━━━━┳━━━━━━━━━━━━━━┳━━━━━━━━━━━━┳━━━━━━━━━━━━┳━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━┓
┃ Destination ┃ Departure dv ┃ Arrival dv ┃   Total dv ┃ Transfer Time ┃ Synodic Period ┃
┡━━━━━━━━━━━━━╇━━━━━━━━━━━━━━╇━━━━━━━━━━━━╇━━━━━━━━━━━━╇━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━┩
│ Mercury     │    8.77 km/s │ 12.58 km/s │ 21.35 km/s │         171 d │          101 d │
│ Venus       │    4.77 km/s │  5.76 km/s │ 10.53 km/s │         217 d │          334 d │
│ Earth       │    2.65 km/s │  2.94 km/s │  5.59 km/s │         259 d │         2.1 yr │
│ Jupiter     │    5.88 km/s │  4.27 km/s │ 10.15 km/s │        3.1 yr │         2.2 yr │
│ Saturn      │    7.56 km/s │  4.58 km/s │ 12.14 km/s │        6.5 yr │         2.0 yr │
│ Uranus      │    8.72 km/s │  4.19 km/s │ 12.91 km/s │       16.7 yr │         1.9 yr │
│ Neptune     │    9.16 km/s │  3.74 km/s │ 12.91 km/s │       31.4 yr │         1.9 yr │
└─────────────┴──────────────┴────────────┴────────────┴───────────────┴────────────────┘
```

## Tests

```bash
cd backend
pytest
```
