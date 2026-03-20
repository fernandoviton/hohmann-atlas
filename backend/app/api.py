import os
from pathlib import Path

import astropy.units as u
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.engine.bodies import PLANETS, get_planet
from app.engine.hohmann import compute_transfer
from app.engine.windows import synodic_period
from app.models import PlanetResponse, TransferResponse

app = FastAPI(title="Hohmann Atlas")

origins = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)

_FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"


def _serialize_transfer(origin: str, destination: str) -> TransferResponse:
    t = compute_transfer(origin, destination)
    syn = synodic_period(origin, destination)
    return TransferResponse(
        origin=t.origin,
        destination=t.destination,
        departure_dv_km_s=round(t.departure_dv.to(u.km / u.s).value, 4),
        arrival_dv_km_s=round(t.arrival_dv.to(u.km / u.s).value, 4),
        delta_v_total_km_s=round(t.delta_v_total.to(u.km / u.s).value, 4),
        transfer_time_days=round(t.transfer_time.to(u.day).value, 4),
        synodic_period_days=round(syn.to(u.day).value, 4),
    )


@app.get("/api/planets", response_model=list[PlanetResponse])
def get_planets():
    return [
        PlanetResponse(
            name=p.name,
            semi_major_axis_au=round(p.semi_major_axis.to(u.AU).value, 4),
            orbital_period_days=round(p.orbital_period.to(u.day).value, 4),
        )
        for p in PLANETS
    ]


@app.get("/api/transfer/{origin}/{destination}", response_model=TransferResponse)
def get_transfer(origin: str, destination: str):
    try:
        get_planet(origin)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Unknown planet: {origin}")
    try:
        get_planet(destination)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Unknown planet: {destination}")

    if get_planet(origin).name == get_planet(destination).name:
        raise HTTPException(status_code=400, detail="Origin and destination are the same")

    return _serialize_transfer(origin, destination)


@app.get("/api/transfers/{origin}", response_model=list[TransferResponse])
def get_campaign(origin: str):
    try:
        origin_planet = get_planet(origin)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Unknown planet: {origin}")

    return [
        _serialize_transfer(origin_planet.name, dest.name)
        for dest in PLANETS
        if dest.name != origin_planet.name
    ]


@app.get("/")
def index():
    return FileResponse(_FRONTEND_DIR / "index.html")
