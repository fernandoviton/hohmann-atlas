from pydantic import BaseModel


class PlanetResponse(BaseModel):
    name: str
    semi_major_axis_au: float
    orbital_period_days: float


class TransferResponse(BaseModel):
    origin: str
    destination: str
    departure_dv_km_s: float
    arrival_dv_km_s: float
    delta_v_total_km_s: float
    transfer_time_days: float
    synodic_period_days: float
