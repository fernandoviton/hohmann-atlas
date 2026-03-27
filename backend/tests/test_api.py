from fastapi.testclient import TestClient

from app.api import app

client = TestClient(app)


def test_get_planets():
    resp = client.get("/api/planets")
    assert resp.status_code == 200
    planets = resp.json()
    assert len(planets) == 8
    for p in planets:
        assert "name" in p
        assert "semi_major_axis_au" in p
        assert "orbital_period_days" in p


def test_cors_headers():
    resp = client.get("/api/planets", headers={"Origin": "https://example.com"})
    assert resp.status_code == 200
    assert "access-control-allow-origin" in resp.headers


# --- Positions endpoint ---


def test_get_positions():
    resp = client.get("/api/positions", params={"date": "2026-06-01"})
    assert resp.status_code == 200
    positions = resp.json()
    assert len(positions) == 8
    for p in positions:
        assert "name" in p
        assert "longitude_rad" in p


def test_get_positions_range():
    resp = client.get("/api/positions", params={"date": "2026-06-01"})
    import math

    for p in resp.json():
        assert 0 <= p["longitude_rad"] < 2 * math.pi


def test_get_positions_missing_date():
    resp = client.get("/api/positions")
    assert resp.status_code == 422


# --- Window endpoint ---


def test_get_window_earth_mars():
    resp = client.get("/api/window/Earth/Mars", params={"date": "2026-06-01"})
    assert resp.status_code == 200
    data = resp.json()
    expected_fields = {
        "origin",
        "destination",
        "launch_date",
        "arrival_date",
        "transfer_time_days",
        "departure_dv_km_s",
        "arrival_dv_km_s",
        "delta_v_total_km_s",
    }
    assert expected_fields <= set(data.keys())
    assert data["launch_date"] >= "2026-06-01"


def test_get_window_unknown_planet():
    resp = client.get("/api/window/Earth/Tatooine", params={"date": "2026-06-01"})
    assert resp.status_code == 404


def test_get_window_same_planet():
    resp = client.get("/api/window/Earth/Earth", params={"date": "2026-06-01"})
    assert resp.status_code == 400


# --- Tour endpoint ---


def test_get_tour_depth_1():
    resp = client.get("/api/tour/Earth", params={"date": "2026-06-01", "depth": 1})
    assert resp.status_code == 200
    data = resp.json()
    assert data["origin"] == "Earth"
    assert data["start_date"] == "2026-06-01"
    assert len(data["options"]) == 7
    for opt in data["options"]:
        assert opt["next_options"] == []
        assert opt["wait_time_days"] >= 0


def test_get_tour_depth_2():
    resp = client.get("/api/tour/Earth", params={"date": "2026-06-01", "depth": 2})
    assert resp.status_code == 200
    data = resp.json()
    has_next = any(len(opt["next_options"]) > 0 for opt in data["options"])
    assert has_next


def test_get_tour_default_depth():
    """Default depth is now 1, so no next_options."""
    resp = client.get("/api/tour/Earth", params={"date": "2026-06-01"})
    assert resp.status_code == 200
    data = resp.json()
    has_next = any(len(opt["next_options"]) > 0 for opt in data["options"])
    assert not has_next


def test_get_tour_unknown_planet():
    resp = client.get("/api/tour/Tatooine", params={"date": "2026-06-01"})
    assert resp.status_code == 404
