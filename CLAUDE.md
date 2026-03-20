# Hohmann Atlas

Planetary-tour mission planner using real orbital mechanics. Computes Hohmann transfer orbits between solar system planets with delta-v budgets, transfer times, and launch windows.

## Directory Structure

```
hohmann-atlas/
  backend/          Python package (engine, CLI, API)
    app/
      engine/       Orbital mechanics (bodies, hohmann, windows)
      cli.py        Rich CLI
      api.py        FastAPI REST API
      models.py     Pydantic response models
      server.py     Uvicorn entry point
    tests/
  frontend/
    index.html      Single-file UI (no build tools)
```

## Setup

```bash
cd backend
python -m venv .venv
# Linux/macOS:
source .venv/bin/activate
# Windows:
.venv/Scripts/activate

pip install -e ".[dev]"
```

## Run

- **CLI:** `hohmann-atlas <planet>`
- **Web server:** `hohmann-serve` → http://127.0.0.1:8000
- **Tests:** `cd backend && pytest`

## Architecture

- Python engine uses astropy Quantities for all physics values
- FastAPI layer serializes Quantities to plain floats for JSON
- Single-file HTML frontend consumes REST API (no build tools)
- Frozen dataclasses for engine results, Pydantic models for API responses

## Conventions

- TDD: write tests before implementation
- All physics values as astropy Quantities internally
- Frozen dataclasses for engine results

## Learnings

- Frontend is a single `index.html` with inline `<style>` and `<script>` — no build tools, no separate CSS/JS files. Favicon is also inline (SVG data URI).
- API serialization: engine returns astropy Quantities; `api.py` converts to plain floats with `round(..., 4)` before building Pydantic models.
- Orbit diagram uses logarithmic scale (`auToR`) so inner planets are visible alongside outer ones.
- The frontend is served by FastAPI via `FileResponse` at `/`, so no CORS needed.
- `httpx` is a dev dependency (needed by FastAPI's `TestClient`).
