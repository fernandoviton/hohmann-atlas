"""E2e tests for row click selection behavior."""

import pytest
from playwright.sync_api import expect


@pytest.mark.e2e
def test_transfer_row_click_applies_active_class(page, live_server):
    """Clicking a transfer table row should add .active class to it."""
    console_msgs = []
    page.on("console", lambda msg: console_msgs.append(f"[{msg.type}] {msg.text}"))

    page.goto(live_server)

    # Select an origin planet
    page.select_option("#origin-select", "Earth")

    # Wait for transfer rows to appear
    page.wait_for_selector("tr.data-row", timeout=15000)

    # Click the first data row
    first_row = page.locator("tr.data-row").first
    dest_text = first_row.locator("td").first.text_content()
    first_row.click()

    # Assert .active class is on the clicked row
    expect(first_row).to_have_class("data-row active", timeout=3000)

    # Assert arcs are filtered: only the selected arc visible
    visible_arcs = page.locator(".transfer-arc").all()
    visible_count = sum(1 for a in visible_arcs if a.is_visible())
    assert visible_count == 1, (
        f"Expected 1 visible arc after selection, got {visible_count}. "
        f"Console: {console_msgs}"
    )


@pytest.mark.e2e
def test_transfer_row_click_toggle_deselects(page, live_server):
    """Clicking the same row twice should deselect (all arcs visible again)."""
    page.goto(live_server)
    page.select_option("#origin-select", "Earth")
    page.wait_for_selector("tr.data-row", timeout=15000)

    first_row = page.locator("tr.data-row").first
    first_row.click()
    expect(first_row).to_have_class("data-row active", timeout=3000)

    # Click again to deselect
    first_row = page.locator("tr.data-row").first
    first_row.click()

    # All arcs should be visible again (no filtering)
    page.wait_for_timeout(500)
    visible_arcs = page.locator(".transfer-arc").all()
    visible_count = sum(1 for a in visible_arcs if a.is_visible())
    total_arcs = len(visible_arcs)
    assert visible_count == total_arcs, (
        f"Expected all {total_arcs} arcs visible after deselect, got {visible_count}"
    )


@pytest.mark.e2e
def test_tour_row_click_updates_date_input(page, live_server):
    """Clicking a tour row should update the date input to match launch date."""
    console_msgs = []
    page.on("console", lambda msg: console_msgs.append(f"[{msg.type}] {msg.text}"))

    page.goto(live_server)

    # Switch to tour mode
    page.click("#mode-tour")

    # Select origin
    page.select_option("#origin-select", "Earth")

    # Wait for tour rows
    page.wait_for_selector("tr.data-row", timeout=30000)

    # Get the launch date from the first row
    first_row = page.locator("tr.data-row").first
    launch_date = first_row.get_attribute("data-date")

    # Click the row
    first_row.click()

    # Assert .active
    expect(first_row).to_have_class("data-row active", timeout=3000)

    # Assert date input updated
    date_input = page.locator("#date-input")
    expect(date_input).to_have_value(launch_date, timeout=3000)


@pytest.mark.e2e
def test_tour_row_click_refetches_tour_for_new_date(page, live_server):
    """Clicking a tour row should refetch tour data for the row's launch date."""
    page.goto(live_server)
    page.click("#mode-tour")
    page.select_option("#origin-select", "Earth")
    page.wait_for_selector("tr.data-row", timeout=30000)

    date_input = page.locator("#date-input")
    initial_date = date_input.input_value()

    # Find a row with a different launch date than the initial
    rows = page.locator("tr.data-row")
    target_idx = None
    for i in range(rows.count()):
        if rows.nth(i).get_attribute("data-date") != initial_date:
            target_idx = i
            break
    assert target_idx is not None, "Need a row with a different date"

    target_row = rows.nth(target_idx)
    expected_date = target_row.get_attribute("data-date")

    # Click the row — should trigger a tour API call with the new date
    with page.expect_request(
        lambda req: "/api/tour/" in req.url and f"date={expected_date}" in req.url,
        timeout=5000,
    ):
        target_row.click()

    # After reload, date input should still show the launch date
    expect(date_input).to_have_value(expected_date, timeout=3000)


@pytest.mark.e2e
def test_tour_row_click_updates_planet_positions(page, live_server):
    """Clicking a tour row should fetch planet positions for the launch date."""
    page.goto(live_server)
    page.click("#mode-tour")
    page.select_option("#origin-select", "Earth")
    page.wait_for_selector("tr.data-row", timeout=30000)

    initial_date = page.locator("#date-input").input_value()
    rows = page.locator("tr.data-row")
    target_idx = None
    for i in range(rows.count()):
        if rows.nth(i).get_attribute("data-date") != initial_date:
            target_idx = i
            break
    assert target_idx is not None

    target_row = rows.nth(target_idx)
    expected_date = target_row.get_attribute("data-date")

    # Click row — should trigger positions API call with the launch date
    with page.expect_request(
        lambda req: "/api/positions" in req.url and f"date={expected_date}" in req.url,
        timeout=5000,
    ):
        target_row.click()
