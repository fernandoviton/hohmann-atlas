"""E2e tests for transfer arc alignment with planet positions."""

import math
import pytest


def _planet_pos(page, name):
    """Return (cx, cy) of a planet dot by name."""
    dot = page.locator(f'.planet-dot[data-planet="{name}"] circle')
    cx = float(dot.get_attribute("cx"))
    cy = float(dot.get_attribute("cy"))
    return cx, cy


def _path_endpoint(d_attr, which):
    """Extract first or last point from an SVG path 'd' attribute.

    Handles both 'M x y A ...' and 'M x,y L x,y L ...' formats.
    """
    parts = d_attr.strip().split()
    if which == "first":
        # After 'M', next two tokens (or one comma-separated) are x y
        after_m = d_attr.strip()[2:].strip()  # skip 'M '
        if "," in after_m.split(" ")[0]:
            tok = after_m.split(" L ")[0] if " L " in after_m else after_m.split()[0]
            x, y = tok.split(",")
        else:
            tokens = after_m.split()
            x, y = tokens[0], tokens[1]
        return float(x), float(y)
    else:  # "last"
        # Last two numeric tokens, or last comma-separated pair
        if " L " in d_attr:
            last_seg = d_attr.strip().split(" L ")[-1].strip()
            if "," in last_seg:
                x, y = last_seg.split(",")
            else:
                tokens = last_seg.split()
                x, y = tokens[0], tokens[1]
        else:
            # SVG arc format: last two tokens are x y
            x, y = parts[-2], parts[-1]
        return float(x), float(y)


def _dist(p1, p2):
    return math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2)


@pytest.mark.e2e
def test_selected_arc_starts_near_origin_planet(page, live_server):
    """When a transfer row is clicked, the visible arc should start near the origin planet."""
    page.goto(live_server)
    page.select_option("#origin-select", "Earth")
    page.wait_for_selector("tr.data-row", timeout=15000)

    # Click first row to select it
    page.locator("tr.data-row").first.click()
    page.wait_for_timeout(500)

    # Get origin planet position
    origin_pos = _planet_pos(page, "Earth")

    # Get the visible arc's start point
    arc = page.locator(".transfer-arc:visible")
    d_attr = arc.get_attribute("d")
    arc_start = _path_endpoint(d_attr, "first")

    distance = _dist(origin_pos, arc_start)
    assert distance < 3.0, (
        f"Arc start {arc_start} should be near origin planet {origin_pos}, "
        f"but distance is {distance:.1f}"
    )


@pytest.mark.e2e
def test_all_arcs_start_near_origin_planet(page, live_server):
    """All transfer arcs (unselected) should start near the origin planet."""
    page.goto(live_server)
    page.select_option("#origin-select", "Earth")
    page.wait_for_selector("tr.data-row", timeout=15000)
    page.wait_for_timeout(500)

    origin_pos = _planet_pos(page, "Earth")

    arcs = page.locator(".transfer-arc").all()
    assert len(arcs) > 0, "Expected at least one arc"

    for i, arc in enumerate(arcs):
        d_attr = arc.get_attribute("d")
        arc_start = _path_endpoint(d_attr, "first")
        distance = _dist(origin_pos, arc_start)
        assert distance < 3.0, (
            f"Arc {i} start {arc_start} should be near origin {origin_pos}, "
            f"distance={distance:.1f}"
        )


@pytest.mark.e2e
@pytest.mark.parametrize("row_idx", [0, 1, 2])
def test_playback_arc_and_craft_visible(page, live_server, row_idx):
    """During playback the transfer arc and spacecraft dot must stay visible for any row."""
    page.goto(live_server)
    page.select_option("#origin-select", "Earth")
    page.wait_for_selector("tr.data-row", timeout=15000)

    rows = page.locator("tr.data-row")
    if row_idx >= rows.count():
        pytest.skip(f"Only {rows.count()} rows available")

    rows.nth(row_idx).click()
    page.wait_for_timeout(300)
    page.locator("#play-btn").click()
    page.wait_for_timeout(1000)

    arcs = page.locator("#transfers .transfer-arc").all()
    assert len(arcs) == 1, f"Expected 1 animation arc, got {len(arcs)}"
    assert arcs[0].is_visible(), "Animation arc should be visible"

    crafts = page.locator("#transfers circle").all()
    assert len(crafts) == 1, f"Expected 1 spacecraft dot, got {len(crafts)}"
    assert crafts[0].is_visible(), "Spacecraft dot should be visible"
