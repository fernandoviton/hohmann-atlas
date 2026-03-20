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

## Phase 4: Deployment
- Azure Container Apps hosting (scales to zero)
- CI/CD pipeline
- Domain and HTTPS setup
- We should consider putting the frontend on gh pages

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
