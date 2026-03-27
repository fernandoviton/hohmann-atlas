from pydantic import BaseModel


class PlanetResponse(BaseModel):
    name: str
    semi_major_axis_au: float
    orbital_period_days: float


class PositionResponse(BaseModel):
    name: str
    longitude_rad: float


class LaunchWindowResponse(BaseModel):
    origin: str
    destination: str
    launch_date: str
    arrival_date: str
    transfer_time_days: float
    departure_dv_km_s: float
    arrival_dv_km_s: float
    delta_v_total_km_s: float


class TourOptionResponse(BaseModel):
    window: LaunchWindowResponse
    wait_time_days: float
    next_options: list["TourOptionResponse"]


class TourResponse(BaseModel):
    origin: str
    start_date: str
    options: list[TourOptionResponse]


TourOptionResponse.model_rebuild()
