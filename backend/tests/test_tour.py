"""Tour planner tests using real ephemeris (depth-1 only for speed)."""

import astropy.units as u
import pytest
from astropy.time import Time

from app.engine.tour import TourNode, TourOption, plan_tour


@pytest.fixture(scope="module")
def earth_tour():
    """Shared depth-1 tour from Earth — computed once for all tests."""
    return plan_tour("earth", Time("2026-06-01"), depth=1)


def test_plan_tour_returns_tour_node(earth_tour):
    assert isinstance(earth_tour, TourNode)


def test_tour_node_fields(earth_tour):
    assert earth_tour.origin == "Earth"
    assert len(earth_tour.options) == 7


def test_tour_options_are_tour_option(earth_tour):
    for opt in earth_tour.options:
        assert isinstance(opt, TourOption)


def test_tour_option_has_wait_time(earth_tour):
    for opt in earth_tour.options:
        wait_days = opt.wait_time.to(u.day).value
        assert wait_days >= 0


def test_tour_option_wait_time_is_launch_minus_start(earth_tour):
    """Wait time for depth-1 options should be launch_date - start_date."""
    start = Time("2026-06-01")
    for opt in earth_tour.options:
        expected_wait = (opt.window.launch_date - start).to(u.day)
        diff = abs(opt.wait_time.to(u.day).value - expected_wait.value)
        assert diff < 1.0


def test_depth_1_has_no_next_options(earth_tour):
    for opt in earth_tour.options:
        assert len(opt.next_options) == 0


def test_progress_callback_fires_with_real_ephemeris():
    """Real depth-1 tour should fire progress callback for each destination."""
    calls = []
    plan_tour("earth", Time("2026-06-01"), depth=1,
              on_progress=lambda hop, orig, dest, i, total: calls.append(
                  (hop, orig, dest, i, total)))
    assert len(calls) == 7
    assert all(c[0] == 1 for c in calls)
    assert any(c[2] == "Mars" for c in calls)
    assert [c[3] for c in calls] == list(range(1, 8))


def test_frozen_dataclasses(earth_tour):
    with pytest.raises(AttributeError):
        earth_tour.origin = "Mars"
    with pytest.raises(AttributeError):
        earth_tour.options[0].wait_time = 0 * u.day
