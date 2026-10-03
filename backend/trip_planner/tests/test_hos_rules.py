"""
Unit tests for HOS regulatory rules:
- 11-hour driving limit
- 14-hour duty window
- 30-minute rest break after 8 hours of driving
- 70/8 rolling cycle limit & 34-hour restart
- Fueling interval (1,000 miles)
- 1 hour pickup & 1 hour dropoff dwell
- Short trip vs multi-day trip
"""
from datetime import datetime, timezone
import pytest
from trip_planner.services.hos_scheduler import HOSScheduler, HOSEvent


@pytest.fixture
def base_start_time():
    return datetime(2026, 10, 5, 8, 0, 0, tzinfo=timezone.utc)


def test_short_trip(base_start_time):
    """
    A short trip (< 300 miles) should complete within a single shift
    without requiring any 10-hour rest or 30-min break.
    """
    legs = [
        {"type": "deadhead", "distance_miles": 50.0, "duration_hours": 1.0},
        {"type": "loaded", "distance_miles": 150.0, "duration_hours": 3.0},
    ]
    events = HOSScheduler.schedule_trip(
        legs=legs,
        current_cycle_used=10.0,
        start_time=base_start_time,
        origin_name="Dallas, TX",
        pickup_name="Fort Worth, TX",
        dropoff_name="Waco, TX",
    )

    activities = [e.activity for e in events]
    assert "Pre-Trip Inspection" in activities
    assert "Pickup Loading" in activities
    assert "Dropoff Unloading" in activities
    assert "10-Hour Mandatory Rest" not in activities
    assert "30-Minute Rest Break" not in activities

    # Total driving should be 4.0 hours
    total_driving = sum(e.duration_hours for e in events if e.status == "DRIVING")
    assert round(total_driving, 1) == 4.0


def test_11_hour_driving_limit(base_start_time):
    """
    A 750-mile leg at 50 mph requires 15 hours of driving.
    Driving must halt at exactly 11.0 hours driving, triggering a 10.0-hour rest
    before the remaining 4.0 hours of driving can proceed.
    """
    legs = [
        {"type": "deadhead", "distance_miles": 10.0, "duration_hours": 0.2},
        {"type": "loaded", "distance_miles": 750.0, "duration_hours": 15.0},
    ]
    events = HOSScheduler.schedule_trip(
        legs=legs,
        current_cycle_used=0.0,
        start_time=base_start_time,
    )

    # Find the first 10-hour rest
    rest_events = [e for e in events if e.activity == "10-Hour Mandatory Rest"]
    assert len(rest_events) >= 1
    first_rest = rest_events[0]

    # Driving hours before the first rest must NOT exceed 11.0 hours
    driving_before_rest = sum(
        e.duration_hours for e in events
        if e.status == "DRIVING" and e.end_time <= first_rest.start_time
    )
    assert round(driving_before_rest, 2) <= 11.0
    assert first_rest.status == "SLEEPER_BERTH"
    assert first_rest.duration_hours == 10.0


def test_14_hour_window(base_start_time):
    """
    Even if driving is under 11 hours, driving cannot extend beyond
    the 14th hour after the shift began.
    Simulate: Pre-trip (0.25h) + Drive (4.0h) + Extended Pickup Dwell (8.0h) + Drive (4.0h).
    At hour 14, driving must be halted for a 10-hour rest.
    """
    legs = [
        {"type": "deadhead", "distance_miles": 200.0, "duration_hours": 4.0},
        {"type": "loaded", "distance_miles": 200.0, "duration_hours": 4.0},
    ]

    # Temporarily customize dwell to simulate long dock delay
    original_pickup_dwell = HOSScheduler.DWELL_PICKUP_HOURS
    try:
        HOSScheduler.DWELL_PICKUP_HOURS = 8.0  # 8 hours loading
        events = HOSScheduler.schedule_trip(
            legs=legs,
            current_cycle_used=0.0,
            start_time=base_start_time,
        )

        # Elapsed time before first rest should not exceed 14.0 hours
        rest_events = [e for e in events if e.activity == "10-Hour Mandatory Rest"]
        assert len(rest_events) >= 1
        first_rest = rest_events[0]
        elapsed = (first_rest.start_time - base_start_time).total_seconds() / 3600.0
        assert round(elapsed, 2) <= 14.05

    finally:
        HOSScheduler.DWELL_PICKUP_HOURS = original_pickup_dwell


def test_30_minute_break_after_8_hours_driving(base_start_time):
    """
    Driving is not permitted if more than 8 consecutive hours have elapsed
    without at least a 30-minute interruption.
    """
    # 500 miles at 50 mph = 10 hours of continuous driving
    legs = [
        {"type": "loaded", "distance_miles": 500.0, "duration_hours": 10.0},
    ]
    events = HOSScheduler.schedule_trip(
        legs=legs,
        current_cycle_used=0.0,
        start_time=base_start_time,
    )

    break_events = [e for e in events if e.activity == "30-Minute Rest Break"]
    assert len(break_events) >= 1
    assert break_events[0].status == "OFF_DUTY"
    assert break_events[0].duration_hours == 0.5

    # Check driving before break is exactly 8.0 hours (or slightly under)
    first_break = break_events[0]
    driving_before_break = sum(
        e.duration_hours for e in events
        if e.status == "DRIVING" and e.end_time <= first_break.start_time
    )
    assert round(driving_before_break, 2) <= 8.0


def test_fuel_interval_every_1000_miles(base_start_time):
    """
    Fueling must occur at least once every 1,000 miles.
    A 2,500-mile trip should trigger at least 2 fuel stops.
    """
    legs = [
        {"type": "loaded", "distance_miles": 2500.0, "duration_hours": 45.0},
    ]
    events = HOSScheduler.schedule_trip(
        legs=legs,
        current_cycle_used=0.0,
        start_time=base_start_time,
    )

    fuel_events = [e for e in events if e.activity == "Fuel Stop"]
    assert len(fuel_events) >= 2
    for fe in fuel_events:
        assert fe.status == "ON_DUTY_NOT_DRIVING"
        assert fe.duration_hours == 0.5


def test_pickup_and_dropoff_dwell(base_start_time):
    """
    Assessment explicitly mandates:
    - 1 hour for pickup (On-Duty Not Driving)
    - 1 hour for drop-off (On-Duty Not Driving)
    """
    legs = [
        {"type": "deadhead", "distance_miles": 50.0, "duration_hours": 1.0},
        {"type": "loaded", "distance_miles": 100.0, "duration_hours": 2.0},
    ]
    events = HOSScheduler.schedule_trip(
        legs=legs,
        current_cycle_used=5.0,
        start_time=base_start_time,
    )

    pickup = [e for e in events if e.activity == "Pickup Loading"]
    dropoff = [e for e in events if e.activity == "Dropoff Unloading"]

    assert len(pickup) == 1
    assert pickup[0].duration_hours == 1.0
    assert pickup[0].status == "ON_DUTY_NOT_DRIVING"

    assert len(dropoff) == 1
    assert dropoff[0].duration_hours == 1.0
    assert dropoff[0].status == "ON_DUTY_NOT_DRIVING"


def test_70_hour_cycle_limit_and_34_hour_restart(base_start_time):
    """
    When accumulated on-duty time reaches 70.0 hours,
    a 34-hour Off-Duty restart must be triggered before further work.
    """
    # Driver starts with 66.0 hours already used in the cycle
    # Pre-trip (0.25h) leaves 3.75h before hitting 70.0h
    legs = [
        {"type": "loaded", "distance_miles": 300.0, "duration_hours": 6.0},
    ]
    events = HOSScheduler.schedule_trip(
        legs=legs,
        current_cycle_used=66.0,
        start_time=base_start_time,
    )

    restarts = [e for e in events if e.activity == "34-Hour Cycle Restart"]
    assert len(restarts) >= 1
    first_restart = restarts[0]
    assert first_restart.status == "OFF_DUTY"
    assert first_restart.duration_hours == 34.0


def test_current_cycle_usage_initial_restart(base_start_time):
    """
    If driver starts with current_cycle_used >= 70.0 hours,
    they must take an immediate 34-hour restart before performing any duty.
    """
    legs = [
        {"type": "loaded", "distance_miles": 100.0, "duration_hours": 2.0},
    ]
    events = HOSScheduler.schedule_trip(
        legs=legs,
        current_cycle_used=70.0,
        start_time=base_start_time,
    )

    assert events[0].activity == "34-Hour Cycle Restart"
    assert events[0].duration_hours == 34.0
    assert events[0].status == "OFF_DUTY"


def test_multi_day_trip(base_start_time):
    """
    A long multi-day haul (~2,200 miles) spans multiple days,
    requiring multiple 10-hour rests and fuel stops.
    """
    legs = [
        {"type": "deadhead", "distance_miles": 200.0, "duration_hours": 3.5},
        {"type": "loaded", "distance_miles": 2000.0, "duration_hours": 36.0},
    ]
    events = HOSScheduler.schedule_trip(
        legs=legs,
        current_cycle_used=15.0,
        start_time=base_start_time,
    )

    rest_count = sum(1 for e in events if e.activity == "10-Hour Mandatory Rest")
    fuel_count = sum(1 for e in events if e.activity == "Fuel Stop")
    assert rest_count >= 3
    assert fuel_count >= 2

    # Trip start to trip end spans at least 3 calendar days
    total_hours = (events[-1].end_time - events[0].start_time).total_seconds() / 3600.0
    assert total_hours > 70.0
