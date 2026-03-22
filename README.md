# Hohmann Atlas

**Live demo**: https://fernandoviton.github.io/hohmann-atlas

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

Run from the `backend/` directory (with the venv activated):

```bash
hohmann-atlas Mars
```

Prints a table of all Hohmann transfers from the given origin planet, showing departure/arrival delta-v, total delta-v, transfer time, and synodic period.

```bash
hohmann-atlas tour Mars --date 2026-06-01 --depth 2
```

Plans a multi-hop tour using real planetary ephemeris. Shows the next launch window from the origin planet, then for each destination shows onward transfer options with wait times, launch/arrival dates, and delta-v. `--depth` controls how many hops to compute (default 2).

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

cd frontend
node --test atlas.test.js
```

## Deployment

The frontend deploys to GitHub Pages, the backend to Azure Container Apps (scales to zero). CI/CD is handled by GitHub Actions.

### One-time Azure setup

Requires the [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) logged in.

```bash
bash infra/setup.sh
```

This creates a resource group, container registry, and container app, then prints the API URL.

### GitHub repository secrets

Set these in Settings > Secrets and variables > Actions > **Repository secrets**:

| Secret | Value |
|---|---|
| `AZURE_CREDENTIALS` | See below |
| `ACR_NAME` | Container registry name (e.g. `hohmannatlas`) |
| `API_URL` | Azure Container App FQDN with `https://` prefix |

To create `AZURE_CREDENTIALS`, run the command printed by `setup.sh` (or see below). The output will have `appId`, `password`, and `tenant` keys — reshape into this format for the secret:

```json
{
  "clientId": "<appId>",
  "clientSecret": "<password>",
  "tenantId": "<tenant>",
  "subscriptionId": "<your subscription id>"
}
```

> **Git Bash users**: prefix az commands containing `/subscriptions/...` paths with `MSYS_NO_PATHCONV=1` to prevent path mangling.

### CORS

The backend needs to allow requests from your GitHub Pages origin. `setup.sh` sets this automatically, but if you need to update it:

```bash
MSYS_NO_PATHCONV=1 az containerapp update --name hohmann-atlas-api --resource-group hohmann-atlas-rg --set-env-vars "ALLOWED_ORIGINS=https://<username>.github.io"
```

### GitHub Pages

Enable in Settings > Pages > Source: **GitHub Actions**.

### How it works

- **`deploy-backend.yml`** — on pushes to `main` touching `backend/`, runs pytest then builds the Docker image in ACR and updates the container app
- **`deploy-frontend.yml`** — on pushes to `main` touching `frontend/`, injects the `API_URL` into `index.html` and deploys to GitHub Pages

### Docker (manual)

```bash
docker build -t hohmann-atlas-api backend
docker run -p 8000:8000 hohmann-atlas-api
```
