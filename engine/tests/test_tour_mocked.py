"""Tour planner tests using mocked ephemeris (depth-2 and progress)."""

import astropy.units as u
from astropy.time import Time, TimeDelta

from app.engine.launch import LaunchWindow
from app.engine.tour import plan_tour


def _make_fake_window():
    """Return a fake find_next_window for fast depth-2 tests."""
    def fake(origin, destination, after):
        launch = after + TimeDelta(30 * u.day)
        arrival = launch + TimeDelta(100 * u.day)
        return LaunchWindow(
            origin=origin.capitalize(), destination=destination.capitalize(),
            launch_date=launch, arrival_date=arrival,
            transfer_time=100 * u.day,
            departure_dv=3.0 * u.km / u.s, arrival_dv=2.0 * u.km / u.s,
            delta_v_total=5.0 * u.km / u.s,
        )
    return fake


def test_depth_2_has_next_options(monkeypatch):
    """Depth-2 should produce nested options for at least one destination."""
    from app.engine import tour
    monkeypatch.setattr(tour, "find_next_window", _make_fake_window())
    node = plan_tour("earth", Time("2026-06-01"), depth=2)
    has_nested = any(len(opt.next_options) > 0 for opt in node.options)
    assert has_nested


def test_depth_2_next_options_exclude_current(monkeypatch):
    """Second-hop options should not include the planet you're already at."""
    from app.engine import tour
    monkeypatch.setattr(tour, "find_next_window", _make_fake_window())
    node = plan_tour("earth", Time("2026-06-01"), depth=2)
    for opt in node.options:
        dest = opt.window.destination
        for sub in opt.next_options:
            assert sub.window.origin == dest
            assert sub.window.destination != dest


def test_depth_2_next_options_wait_time(monkeypatch):
    """Wait time for second-hop should be relative to arrival at first hop."""
    from app.engine import tour
    monkeypatch.setattr(tour, "find_next_window", _make_fake_window())
    node = plan_tour("earth", Time("2026-06-01"), depth=2)
    for opt in node.options:
        arrival = opt.window.arrival_date
        for sub in opt.next_options:
            expected_wait = (sub.window.launch_date - arrival).to(u.day)
            diff = abs(sub.wait_time.to(u.day).value - expected_wait.value)
            assert diff < 1.0


def test_depth_2_progress_callback(monkeypatch):
    """Depth-2 progress should fire for every window at every depth (7 + 7*7 = 56)."""
    from app.engine import tour
    monkeypatch.setattr(tour, "find_next_window", _make_fake_window())
    calls = []
    plan_tour("earth", Time("2026-06-01"), depth=2,
              on_progress=lambda hop, orig, dest, i, total: calls.append(
                  (hop, orig, dest, i, total)))
    assert len(calls) == 56
    # Hop 1 calls should have hop_level=1, hop 2 calls should have hop_level=2
    hop1_calls = [c for c in calls if c[0] == 1]
    hop2_calls = [c for c in calls if c[0] == 2]
    assert len(hop1_calls) == 7
    assert len(hop2_calls) == 49  # 7 * 7
    # Each hop-2 call should have origin matching a hop-1 destination
    hop1_dests = {c[2] for c in hop1_calls}
    assert all(c[1] in hop1_dests for c in hop2_calls)
