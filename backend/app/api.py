import os
import warnings
from pathlib import Path

import astropy.units as u
from astropy.time import Time
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.engine.bodies import PLANETS, get_planet
from app.engine.ephemeris import heliocentric_longitude
from app.engine.launch import find_next_window
from app.engine.tour import plan_tour
from app.models import (
    LaunchWindowResponse,
    PlanetResponse,
    PositionResponse,
    TourOptionResponse,
    TourResponse,
)

app = FastAPI(title="Hohmann Atlas")

origins = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)

_FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"


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


def _serialize_window(w) -> LaunchWindowResponse:
    return LaunchWindowResponse(
        origin=w.origin,
        destination=w.destination,
        launch_date=w.launch_date.iso[:10],
        arrival_date=w.arrival_date.iso[:10],
        transfer_time_days=round(w.transfer_time.to(u.day).value, 4),
        departure_dv_km_s=round(w.departure_dv.to(u.km / u.s).value, 4),
        arrival_dv_km_s=round(w.arrival_dv.to(u.km / u.s).value, 4),
        delta_v_total_km_s=round(w.delta_v_total.to(u.km / u.s).value, 4),
    )


def _serialize_tour_option(opt) -> TourOptionResponse:
    return TourOptionResponse(
        window=_serialize_window(opt.window),
        wait_time_days=round(opt.wait_time.to(u.day).value, 4),
        next_options=[_serialize_tour_option(n) for n in opt.next_options],
    )


def _parse_date(date: str) -> Time:
    try:
        return Time(date)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid date: {date}")


@app.get("/api/positions", response_model=list[PositionResponse])
def get_positions(date: str = Query()):
    t = _parse_date(date)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return [
            PositionResponse(
                name=p.name,
                longitude_rad=round(
                    heliocentric_longitude(p.name, t).to(u.rad).value, 4
                ),
            )
            for p in PLANETS
        ]


@app.get(
    "/api/window/{origin}/{destination}", response_model=LaunchWindowResponse
)
def get_window(origin: str, destination: str, date: str = Query()):
    try:
        get_planet(origin)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Unknown planet: {origin}")
    try:
        get_planet(destination)
    except ValueError:
        raise HTTPException(
            status_code=404, detail=f"Unknown planet: {destination}"
        )
    if get_planet(origin).name == get_planet(destination).name:
        raise HTTPException(
            status_code=400, detail="Origin and destination are the same"
        )

    t = _parse_date(date)
    try:
        w = find_next_window(origin, destination, t)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _serialize_window(w)


@app.get("/api/tour/{origin}", response_model=TourResponse)
def get_tour(origin: str, date: str = Query(), depth: int = Query(default=1)):
    try:
        origin_planet = get_planet(origin)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Unknown planet: {origin}")

    if not 1 <= depth <= 3:
        raise HTTPException(
            status_code=400, detail="Depth must be between 1 and 3"
        )

    t = _parse_date(date)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            node = plan_tour(origin_planet.name, t, depth=depth)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return TourResponse(
        origin=node.origin,
        start_date=t.iso[:10],
        options=[_serialize_tour_option(opt) for opt in node.options],
    )


if _FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=_FRONTEND_DIR, html=True), name="static")
