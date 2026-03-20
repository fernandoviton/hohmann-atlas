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

## Phase 4.5: Fix the orbit goals
- Use the basic math we have but then set the target to be to more specific targets, which are also rotating, not just the orbit itself (or maybe add that as an additional mode)
- Notes from the boss: there are pretty good, modular planetary transfer calculators (not JPL-level detail but that's unnecessary). With these, we should ask Claude to code up a "planetary tour" tool with a fun scifi UI which, given a date and a starting circular orbit around a planet (Mars), tells you how much deltaV and time are required to Hohmann transfer from start orbit to a Destination 1 orbit AND THEN (this is the cool part), provides all the options for where to go from there (in other words, all of the Hohmann transfers possible from Destination 1 at the time of arrival to any number of other places, how long you would have to wait, how long the trip would be and how much deltaV would be required.) On the transfer calculator, the issue is timing with respect to where the destination planet is along their orbit. In other words, you can easily calculate the transfer but all that will do is deposit you in the orbit of the target. The planet might be very well on the other side of the solar system. Thus, for these kinds of transfers you need to wait until the target planet is in the right place (relative to where you are) so that when you get there, the planet go there too, if that makes sense. This is actually the cool part of using this in game. For any transfer you contemplate, once there you need the system to calculate what other possibilities exist, each with their own wait times around the target planet. The only way to do this is to ask Claude to use known python libraries that calculate the positions of the planets given the actual date.

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
