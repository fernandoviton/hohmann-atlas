# Hohmann Atlas — Future Roadmap

## ~~Phase 1: Orbital Mechanics Engine~~ ✓
- Python engine with astropy units, CLI, tests

## ~~Phase 2: API~~ ✓
- FastAPI backend exposing transfer computations as REST endpoints
- Pydantic response models, uvicorn server entry point

## ~~Phase 3: Frontend~~ ✓
- Single-file HTML/CSS/JS web UI consuming the FastAPI backend
- Interactive planet selector with animated SVG orbit diagram
- Campaign table with color-coded delta-v

## ~~Phase 4: Deployment~~ ✓
- Backend on Azure Container Apps (scales to zero, Dockerfile + infra/setup.sh)
- Frontend on GitHub Pages
- CI/CD via GitHub Actions (ci.yml, deploy-backend.yml, deploy-frontend.yml)
- CORS middleware with configurable ALLOWED_ORIGINS env var
- Frontend API_BASE configurable for split deploy

## ~~Phase 4.5: Real Planetary Positions & Tour Engine~~ ✓
- Ephemeris module using astropy's HeliocentricMeanEcliptic for real planetary positions at any date
- Launch window finder: computes required phase angle, searches for next window via daily stepping + bisection
- Multi-hop tour planner: given origin + date + configurable depth, finds all transfer options with wait times, then recursively finds options from each destination
- CLI `tour` subcommand with argparse (`hohmann-atlas tour earth --date 2026-06-01 --depth 2`)
- Backward-compatible: existing `hohmann-atlas <planet>` still works
- Heliocentric transfers only (escape/capture delta-v from planetary parking orbits deferred to Phase 6)

## Phase 4.6: Tour API & Frontend
- REST endpoints: `GET /api/window/{origin}/{destination}?date=...`, `GET /api/tour/{origin}?date=...&depth=...`
- Frontend tour mode: date picker, expandable tour table with second-hop options
- Orbit diagram: show planets at real positions for selected date
- Animated transfer playback: planets move along orbits, spacecraft travels the arc, showing timing alignment

## Phase 5: Test UI
- Manual and automated verification of the web UI
- Cross-browser testing (Edge, Chrome, Firefox)
- Verify orbit diagram renders correctly at different viewport sizes
- Confirm transfer arc animations, table/diagram hover sync, and planet selection all work

## Phase 6: Improve UI
- Polish visual design and interactions
- Improve orbit diagram accuracy and aesthetics
- Add responsive layout for mobile
- Accessibility improvements
- Loading states and error handling in the UI
- Consider adding transfer details panel on arc/row click
- Model escape/capture delta-v from planetary parking orbits (currently heliocentric only)
- Sci-fi themed UI styling
