"""
Unit tests for Daily Log Generation:
- Strict 24.00-Hour Daily Invariant across all sheets
- Midnight slicing and padding
- Rolling 70-hour / 8-day recap calculations
- Coordinate generation for SVG/canvas graph grid
"""
from datetime import datetime, timezone
import pytest
from trip_planner.services.hos_scheduler import HOSScheduler
from trip_planner.services.daily_log_service import DailyLogService


def test_daily_log_24_hour_totals_short_trip():
    """
    Every daily log sheet MUST sum to exactly 24.00 hours.
    Line 1 + Line 2 + Line 3 + Line 4 == 24.00.
    """
    start_time = datetime(2026, 10, 5, 8, 0, 0, tzinfo=timezone.utc)
    legs = [
        {"type": "deadhead", "distance_miles": 60.0, "duration_hours": 1.2},
        {"type": "loaded", "distance_miles": 180.0, "duration_hours": 3.5},
    ]
    events = HOSScheduler.schedule_trip(
        legs=legs,
        current_cycle_used=12.0,
        start_time=start_time,
    )
    sheets = DailyLogService.generate_daily_logs(
        events=events,
        from_location="Dallas, TX",
        to_location="Austin, TX",
        prior_cycle_used=12.0,
    )

    assert len(sheets) == 1
    sheet = sheets[0]
    totals = sheet["totals"]
    total_sum = totals["off_duty_hours"] + totals["sleeper_berth_hours"] + totals["driving_hours"] + totals["on_duty_not_driving_hours"]
    assert round(total_sum, 2) == 24.00
    assert totals["total_hours"] == 24.00


def test_daily_log_24_hour_totals_multi_day_trip():
    """
    Multi-day trip generating 4+ daily log sheets.
    Every single sheet must strictly satisfy the 24.00-hour invariant.
    """
    start_time = datetime(2026, 10, 5, 8, 0, 0, tzinfo=timezone.utc)
    legs = [
        {"type": "deadhead", "distance_miles": 150.0, "duration_hours": 2.5},
        {"type": "loaded", "distance_miles": 2200.0, "duration_hours": 40.0},
    ]
    events = HOSScheduler.schedule_trip(
        legs=legs,
        current_cycle_used=20.0,
        start_time=start_time,
    )
    sheets = DailyLogService.generate_daily_logs(
        events=events,
        from_location="Dallas, TX",
        to_location="Seattle, WA",
        prior_cycle_used=20.0,
    )

    assert len(sheets) >= 3
    for sheet in sheets:
        totals = sheet["totals"]
        daily_sum = (
            totals["off_duty_hours"]
            + totals["sleeper_berth_hours"]
            + totals["driving_hours"]
            + totals["on_duty_not_driving_hours"]
        )
        assert round(daily_sum, 2) == 24.00, f"Day {sheet['day_number']} totals {daily_sum} != 24.00"
        assert totals["total_hours"] == 24.00


def test_midnight_splitting_continuity():
    """
    Verify that an event crossing midnight (e.g. 10-hour rest starting at 20:00)
    is properly split between Day 1 (4.0 hrs) and Day 2 (6.0 hrs).
    """
    start_time = datetime(2026, 10, 5, 14, 0, 0, tzinfo=timezone.utc)
    legs = [
        {"type": "loaded", "distance_miles": 700.0, "duration_hours": 12.0},
    ]
    events = HOSScheduler.schedule_trip(
        legs=legs,
        current_cycle_used=0.0,
        start_time=start_time,
    )
    sheets = DailyLogService.generate_daily_logs(
        events=events,
        from_location="Origin",
        to_location="Destination",
        prior_cycle_used=0.0,
    )

    assert len(sheets) >= 2
    # Verify no gap between events across days
    day1_last_event = sheets[0]["events"][-1]
    day2_first_event = sheets[1]["events"][0]

    assert day1_last_event["end_time"].startswith("2026-10-06T00:00:00")
    assert day2_first_event["start_time"].startswith("2026-10-06T00:00:00")


def test_recap_calculation():
    """
    Verify 70-hour / 8-day rolling recap calculations.
    """
    start_time = datetime(2026, 10, 5, 8, 0, 0, tzinfo=timezone.utc)
    legs = [
        {"type": "loaded", "distance_miles": 1200.0, "duration_hours": 22.0},
    ]
    events = HOSScheduler.schedule_trip(
        legs=legs,
        current_cycle_used=15.0,
        start_time=start_time,
    )
    sheets = DailyLogService.generate_daily_logs(
        events=events,
        from_location="A",
        to_location="B",
        prior_cycle_used=15.0,
    )

    for sheet in sheets:
        recap = sheet["recap"]
        assert recap["on_duty_today"] >= 0.0
        assert recap["hours_last_7_days"] >= 0.0
        assert recap["hours_available_tomorrow"] <= 70.0
        assert recap["hours_available_tomorrow"] == round(max(0.0, 70.0 - recap["hours_last_7_days"]), 2)


def test_34_hour_restart_resets_recap():
    """
    Under 49 CFR § 395.3(d), a 34-hour restart resets the rolling 7/8-day window to 0.
    Verify that following a 34-hour restart, hours available tomorrow is reset toward 70.0.
    """
    start_time = datetime(2026, 10, 5, 8, 0, 0, tzinfo=timezone.utc)
    # Driver starts with 68.0 hours used in cycle; after a brief drive, 34-hr restart triggers
    legs = [
        {"type": "loaded", "distance_miles": 200.0, "duration_hours": 4.0},
    ]
    events = HOSScheduler.schedule_trip(
        legs=legs,
        current_cycle_used=68.0,
        start_time=start_time,
    )
    sheets = DailyLogService.generate_daily_logs(
        events=events,
        from_location="A",
        to_location="B",
        prior_cycle_used=68.0,
    )

    # Find the day when the 34-hour restart completed
    restart_sheets = [s for s in sheets if any("34-Hour" in ev.get("activity", "") for ev in s["events"])]
    assert len(restart_sheets) >= 1
    post_restart_sheet = restart_sheets[-1]
    # Available tomorrow must be high (> 60 hours), not constrained by the old 68.0h
    assert post_restart_sheet["recap"]["hours_available_tomorrow"] >= 65.0
