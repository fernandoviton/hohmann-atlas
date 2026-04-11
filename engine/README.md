# Engine

The engine is a Python package with two roles:

1. **CLI tool** — `hohmann-atlas` prints tour plans to the terminal using Rich tables and real astropy ephemeris.
2. **Cache generation** — precomputes the static JSON files that the frontend consumes (`windows.json`, `planets.json`, test fixtures).

There is no server or API. The frontend is a fully static site that ships its own data.

## Orbital engine

The engine in `app/engine/` does the actual physics:

| Module | Purpose |
|---|---|
| `bodies.py` | Planet constants (semi-major axes, Kepler-derived periods) |
| `hohmann.py` | Hohmann transfer computation (vis-viva, delta-v, transfer time) |
| `ephemeris.py` | Heliocentric longitudes and phase angles via astropy |
| `windows.py` | Synodic period calculation |
| `launch.py` | Launch window lookup (cache + Hohmann recomputation) |
| `tour.py` | Multi-hop tour planner |
| `cache.py` | Load and query the precomputed `windows.json` |

## CLI

```bash
hohmann-atlas Mars --date 2026-06-01 --depth 2
```

## Cache generation

```bash
# Generate a batch of launch windows:
python -m app.engine.generate_cache --start 2025-01-01 --end 2050-01-01

# Merge all batches into the final windows.json (also copies to frontend/data/):
python -m app.engine.generate_cache --merge

# Regenerate planets.json:
python -m app.engine.generate_planets

# Regenerate golden test fixtures for frontend JS tests:
python generate_test_fixtures.py
```

## Tests

```bash
pytest           # fast tests (engine + CLI)
pytest -m slow   # cache generation correctness tests
```
