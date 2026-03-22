# Hohmann Atlas

Planetary-tour mission planner using real orbital mechanics. Computes Hohmann transfer orbits between solar system planets with delta-v budgets, transfer times, and launch windows.

## Directory Structure

```
hohmann-atlas/
  backend/          Python package (engine, CLI, API)
    app/
      engine/       Orbital mechanics (bodies, hohmann, windows, ephemeris, launch, tour)
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

- **CLI:** `hohmann-atlas <planet>` (transfers) or `hohmann-atlas tour <planet> --date 2026-06-01 --depth 2` (tour)
- **Web server:** `hohmann-serve` → http://127.0.0.1:8000
- **Tests (backend):** `cd backend && pytest`
- **Tests (frontend):** `cd frontend && node --test atlas.test.js`

## Architecture

- Python engine uses astropy Quantities for all physics values
- FastAPI layer serializes Quantities to plain floats for JSON
- Frontend HTML imports pure logic from `atlas.js` module (no build tools)
- Frozen dataclasses for engine results, Pydantic models for API responses

## Conventions

- TDD: write tests before implementation
- All physics values as astropy Quantities internally
- Frozen dataclasses for engine results
- Keep `README.md` in sync when adding/changing commands, tests, or setup steps

## Deployment

- **Backend**: Azure Container Apps (scales to zero). Dockerfile in `backend/`, one-time setup via `infra/setup.sh`.
- **Frontend**: GitHub Pages. `sed` injects `API_URL` secret at deploy time.
- **CI/CD**: GitHub Actions — `ci.yml` (pytest on PRs), `deploy-backend.yml`, `deploy-frontend.yml`.
- **CORS**: `ALLOWED_ORIGINS` env var (comma-separated, default `*` for local dev).
- **Secrets needed**: `AZURE_CREDENTIALS`, `ACR_NAME`, `API_URL`.

## Learnings

- Frontend `index.html` with inline `<style>` and `<script type="module">` importing from `atlas.js`. No build tools. Favicon is inline (SVG data URI). `atlas.js` contains pure state/logic (no DOM); tested with Node.js built-in test runner.
- API serialization: engine returns astropy Quantities; `api.py` converts to plain floats with `round(..., 4)` before building Pydantic models.
- Orbit diagram uses logarithmic scale (`auToR`) so inner planets are visible alongside outer ones.
- For local dev, FastAPI still serves `index.html` at `/` and CORS defaults to `*`. For production, frontend is on GitHub Pages with `API_BASE` pointing to Azure.
- `httpx` is a dev dependency (needed by FastAPI's `TestClient`).
