# Hohmann Atlas

Planetary-tour mission planner using real orbital mechanics. Computes Hohmann transfer orbits between solar system planets with delta-v budgets, transfer times, and launch windows.

## Directory Structure

```
hohmann-atlas/
  engine/           Python package (orbital engine, CLI, cache generation)
    app/
      engine/       Orbital mechanics (bodies, hohmann, windows, ephemeris, launch, tour)
      cli.py        Rich CLI
    tests/
  frontend/
    index.html      Single-file UI (no build tools)
    atlas.js        Pure state/logic (no DOM)
    orbit.js        Orbit diagram geometry
    cache.js        Window cache loader + lookup
    positions.js    JPL mean elements for planet positions
    tour.js         Client-side tour planner
    data/           Static JSON (planets.json, windows.json)
    test-fixtures/  Golden test data from Python engine
```

## Setup

```bash
cd engine
python -m venv .venv
# Linux/macOS:
source .venv/bin/activate
# Windows:
.venv/Scripts/activate

pip install -e ".[dev]"
```

## Run

- **CLI:** `hohmann-atlas <planet> --date 2026-06-01 [--depth 1]`
- **Web UI:** Serve `frontend/` with any static HTTP server (e.g. `python -m http.server -d frontend`)
- **Tests (engine):** `cd engine && pytest`
- **Tests (frontend):** `cd frontend && node --test atlas.test.js orbit.test.js cache.test.js positions.test.js tour.test.js`

## Architecture

- Python engine uses astropy Quantities for all physics values
- Frontend is a fully static site — no server needed at runtime
- `cache.js` loads precomputed `windows.json` (launch windows for all planet pairs)
- `positions.js` computes planet positions using JPL mean orbital elements + Kepler's equation
- `tour.js` plans multi-hop tours using cached window data
- Frontend HTML imports pure logic from JS modules (no build tools)
- Frozen dataclasses for engine results

## Conventions

- TDD: write tests before implementation
- All physics values as astropy Quantities internally (Python)
- Frozen dataclasses for engine results
- Keep `README.md` in sync when adding/changing commands, tests, or setup steps

## Cache Generation

The window cache covers 2025-2200 and is checked into the repo:
- **Generate batch:** `cd engine && python -m app.engine.generate_cache --start 2025-01-01 --end 2050-01-01`
- **Merge batches:** `cd engine && python -m app.engine.generate_cache --merge`
- **Generate planets.json:** `cd engine && python -m app.engine.generate_planets`
- **Generate test fixtures:** `cd engine && python generate_test_fixtures.py`

Merging also copies `windows.json` to `frontend/data/`.

## Deployment

- **Frontend**: GitHub Pages. Static files served directly.
- **CI/CD**: GitHub Actions — `ci.yml` (pytest + node --test on PRs), `deploy-frontend.yml`.

## Learnings

- Frontend `index.html` with inline `<style>` and `<script type="module">` importing from JS modules. No build tools. Favicon is inline (SVG data URI).
- Orbit diagram uses logarithmic scale (`auToR`) so inner planets are visible alongside outer ones.
- `positions.js` uses JPL mean orbital elements with Kepler's equation (~1-3 degree accuracy), good enough for visualization.
- Tour planner uses cache `transfer_time_days` for arrival dates (not Hohmann recomputation), so results match the precomputed cache exactly.
- `httpx` is no longer a dependency (was needed by FastAPI's `TestClient`).
