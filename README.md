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

```bash
hohmann-atlas Mars
```

Prints a table of all Hohmann transfers from the given origin planet, showing departure/arrival delta-v, total delta-v, transfer time, and synodic period.

## Example Output

```
                          Hohmann Transfers from Mars
+-----------------------------------------------------------------------------+
| Destination | Departure dv | Arrival dv |   Total dv | Transfer Time | ... |
|-------------+--------------+------------+------------+---------------+-----|
| Earth       |  2.65 km/s   |  2.94 km/s |  5.59 km/s |       259 d   | ... |
| Jupiter     |  5.88 km/s   |  4.27 km/s | 10.15 km/s |      3.1 yr   | ... |
+-----------------------------------------------------------------------------+
```

## Tests

```bash
cd backend
pytest
```
