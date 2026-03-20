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


def test_get_transfer():
    resp = client.get("/api/transfer/Earth/Mars")
    assert resp.status_code == 200
    data = resp.json()
    assert 5.0 <= data["delta_v_total_km_s"] <= 6.5
    assert 250 <= data["transfer_time_days"] <= 270


def test_get_transfer_case_insensitive():
    resp = client.get("/api/transfer/earth/mars")
    assert resp.status_code == 200


def test_get_transfer_same_planet():
    resp = client.get("/api/transfer/Earth/Earth")
    assert resp.status_code == 400


def test_get_transfer_unknown_planet():
    resp = client.get("/api/transfer/Earth/Tatooine")
    assert resp.status_code == 404


def test_get_campaign():
    resp = client.get("/api/transfers/Earth")
    assert resp.status_code == 200
    transfers = resp.json()
    assert len(transfers) == 7
    expected_fields = {
        "origin",
        "destination",
        "departure_dv_km_s",
        "arrival_dv_km_s",
        "delta_v_total_km_s",
        "transfer_time_days",
        "synodic_period_days",
    }
    for t in transfers:
        assert expected_fields <= set(t.keys())


def test_get_campaign_unknown():
    resp = client.get("/api/transfers/Tatooine")
    assert resp.status_code == 404
