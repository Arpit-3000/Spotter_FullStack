"""
HOS (Hours of Service) Trip Scheduling and Simulation Engine.
Implements FMCSA 49 CFR Part 395 for Property-Carrying CMV Drivers:
- 11-Hour Driving Limit
- 14-Hour Consecutive Duty Window
- 30-Minute Rest Break after 8 hours of driving
- 70-Hour / 8-Day Rolling Cycle Limit
- 34-Hour Restart Provision
- Fueling at least once every 1,000 miles (30 min On-Duty Not Driving)
- 1 Hour Dwell for Pickup and 1 Hour Dwell for Dropoff (On-Duty Not Driving)
- 15-Minute Pre-Trip Inspection at Shift Start (On-Duty Not Driving)
"""
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
import uuid


class HOSEvent:
    def __init__(
        self,
        start_time: datetime,
        end_time: datetime,
        status: str,
        activity: str,
        location: str,
        remarks: str,
        odometer_start: float = 0.0,
        odometer_end: float = 0.0,
    ):
        self.id = str(uuid.uuid4())
        self.start_time = start_time
        self.end_time = end_time
        self.duration_hours = round((end_time - start_time).total_seconds() / 3600.0, 4)
        self.status = status  # OFF_DUTY, SLEEPER_BERTH, DRIVING, ON_DUTY_NOT_DRIVING
        self.activity = activity
        self.location = location
        self.remarks = remarks
        self.odometer_start = round(odometer_start, 2)
        self.odometer_end = round(odometer_end, 2)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "duration_hours": self.duration_hours,
            "status": self.status,
            "activity": self.activity,
            "location": self.location,
            "remarks": self.remarks,
            "odometer_start": self.odometer_start,
            "odometer_end": self.odometer_end,
        }


class HOSScheduler:
    # Regulatory Constants
    MAX_DRIVING_SHIFT_HOURS = 11.0
    MAX_WINDOW_SHIFT_HOURS = 14.0
    MAX_DRIVING_BEFORE_BREAK_HOURS = 8.0
    REST_BREAK_DURATION_HOURS = 0.5    # 30 minutes
    SHIFT_REST_DURATION_HOURS = 10.0   # 10 consecutive hours
    CYCLE_LIMIT_HOURS = 70.0           # 70 hours in 8 days
    CYCLE_RESTART_HOURS = 34.0         # 34 consecutive hours off-duty
    PRE_TRIP_INSPECTION_HOURS = 0.25   # 15 minutes PTI
    FUEL_INTERVAL_MILES = 1000.0
    FUEL_DURATION_HOURS = 0.5          # 30 minutes
    DWELL_PICKUP_HOURS = 1.0           # 1.0 hour
    DWELL_DROPOFF_HOURS = 1.0          # 1.0 hour

    @classmethod
    def schedule_trip(
        cls,
        legs: List[Dict[str, Any]],
        current_cycle_used: float,
        start_time: Optional[datetime] = None,
        origin_name: str = "Origin",
        pickup_name: str = "Pickup",
        dropoff_name: str = "Dropoff",
    ) -> List[HOSEvent]:
        """
        Takes route legs, starting on-duty cycle hours, and departure datetime,
        and generates a fully compliant, continuous sequence of HOS events.
        """
        if start_time is None:
            # Default to 08:00 AM UTC today
            now = datetime.now(timezone.utc)
            start_time = datetime(now.year, now.month, now.day, 8, 0, 0, tzinfo=timezone.utc)

        current_time = start_time
        events: List[HOSEvent] = []

        # Tracking state
        shift_driving = 0.0
        shift_window = 0.0
        drive_since_break = 0.0
        cycle_used = float(current_cycle_used)
        odometer_since_fuel = 0.0
        total_odometer = 0.0

        # Check if driver immediately needs a 34-hour restart before beginning
        if cycle_used >= cls.CYCLE_LIMIT_HOURS:
            restart_event = HOSEvent(
                start_time=current_time,
                end_time=current_time + timedelta(hours=cls.CYCLE_RESTART_HOURS),
                status="OFF_DUTY",
                activity="34-Hour Cycle Restart",
                location=origin_name,
                remarks=f"34-Hour Restart taken at {origin_name} to reset {cycle_used:.1f}h cycle",
                odometer_start=total_odometer,
                odometer_end=total_odometer,
            )
            events.append(restart_event)
            current_time = restart_event.end_time
            cycle_used = 0.0
            shift_driving = 0.0
            shift_window = 0.0
            drive_since_break = 0.0

        # Start Shift: Pre-Trip Inspection (15 min On-Duty Not Driving)
        pti_event = HOSEvent(
            start_time=current_time,
            end_time=current_time + timedelta(hours=cls.PRE_TRIP_INSPECTION_HOURS),
            status="ON_DUTY_NOT_DRIVING",
            activity="Pre-Trip Inspection",
            location=origin_name,
            remarks=f"Pre-Trip Inspection at {origin_name}",
            odometer_start=total_odometer,
            odometer_end=total_odometer,
        )
        events.append(pti_event)
        current_time = pti_event.end_time
        shift_window += cls.PRE_TRIP_INSPECTION_HOURS
        cycle_used += cls.PRE_TRIP_INSPECTION_HOURS

        for leg_idx, leg in enumerate(legs):
            leg_type = leg.get("type", "haul")  # 'deadhead' (to pickup) or 'loaded' (to dropoff)
            leg_name = pickup_name if leg_type == "deadhead" else dropoff_name
            leg_miles = float(leg.get("distance_miles", 0.0))
            leg_hours = float(leg.get("duration_hours", 0.0))
            dwell_hours = cls.DWELL_PICKUP_HOURS if leg_type == "deadhead" else cls.DWELL_DROPOFF_HOURS
            dwell_activity = "Pickup Loading" if leg_type == "deadhead" else "Dropoff Unloading"

            # Derive average speed for this leg
            speed = (leg_miles / leg_hours) if leg_hours > 0 else 55.0
            speed = max(30.0, min(speed, 65.0))  # Clamp between 30 and 65 mph

            remaining_leg_miles = leg_miles

            # Drive this leg, chunked by HOS rules and fuel requirements
            while remaining_leg_miles > 0.01:
                # 1. Check constraints on driving duration
                drive_avail_break = max(0.0, cls.MAX_DRIVING_BEFORE_BREAK_HOURS - drive_since_break)
                drive_avail_shift = max(0.0, cls.MAX_DRIVING_SHIFT_HOURS - shift_driving)
                drive_avail_window = max(0.0, cls.MAX_WINDOW_SHIFT_HOURS - shift_window)
                drive_avail_cycle = max(0.0, cls.CYCLE_LIMIT_HOURS - cycle_used)
                miles_to_fuel = max(0.0, cls.FUEL_INTERVAL_MILES - odometer_since_fuel)
                drive_avail_fuel = miles_to_fuel / speed if speed > 0 else 10.0

                # Check if an interrupting rest/restart/break is required BEFORE driving
                if drive_avail_cycle <= 0.01:
                    # Trigger 34-Hour Restart
                    restart_event = HOSEvent(
                        start_time=current_time,
                        end_time=current_time + timedelta(hours=cls.CYCLE_RESTART_HOURS),
                        status="OFF_DUTY",
                        activity="34-Hour Cycle Restart",
                        location=f"En route ({total_odometer:.0f} mi)",
                        remarks=f"34-Hour Restart taken at mile {total_odometer:.0f} (70-hour cycle exhausted)",
                        odometer_start=total_odometer,
                        odometer_end=total_odometer,
                    )
                    events.append(restart_event)
                    current_time = restart_event.end_time
                    cycle_used = 0.0
                    shift_driving = 0.0
                    shift_window = 0.0
                    drive_since_break = 0.0
                    continue

                if drive_avail_shift <= 0.01 or drive_avail_window <= 0.01:
                    # 10-Hour Mandatory Rest
                    rest_event = HOSEvent(
                        start_time=current_time,
                        end_time=current_time + timedelta(hours=cls.SHIFT_REST_DURATION_HOURS),
                        status="SLEEPER_BERTH",
                        activity="10-Hour Mandatory Rest",
                        location=f"Truck Stop (Mile {total_odometer:.0f})",
                        remarks=f"10-Hour Rest taken at mile {total_odometer:.0f} (Shift limits reached)",
                        odometer_start=total_odometer,
                        odometer_end=total_odometer,
                    )
                    events.append(rest_event)
                    current_time = rest_event.end_time
                    shift_driving = 0.0
                    shift_window = 0.0
                    drive_since_break = 0.0

                    # Start new shift with Pre-Trip Inspection
                    pti_ev = HOSEvent(
                        start_time=current_time,
                        end_time=current_time + timedelta(hours=cls.PRE_TRIP_INSPECTION_HOURS),
                        status="ON_DUTY_NOT_DRIVING",
                        activity="Pre-Trip Inspection",
                        location=f"Truck Stop (Mile {total_odometer:.0f})",
                        remarks=f"Pre-Trip Inspection at mile {total_odometer:.0f}",
                        odometer_start=total_odometer,
                        odometer_end=total_odometer,
                    )
                    events.append(pti_ev)
                    current_time = pti_ev.end_time
                    shift_window += cls.PRE_TRIP_INSPECTION_HOURS
                    cycle_used += cls.PRE_TRIP_INSPECTION_HOURS
                    continue

                if drive_avail_break <= 0.01:
                    # 30-Minute Rest Break
                    break_event = HOSEvent(
                        start_time=current_time,
                        end_time=current_time + timedelta(hours=cls.REST_BREAK_DURATION_HOURS),
                        status="OFF_DUTY",
                        activity="30-Minute Rest Break",
                        location=f"Rest Area (Mile {total_odometer:.0f})",
                        remarks=f"30-Minute Rest Break taken at mile {total_odometer:.0f}",
                        odometer_start=total_odometer,
                        odometer_end=total_odometer,
                    )
                    events.append(break_event)
                    current_time = break_event.end_time
                    shift_window += cls.REST_BREAK_DURATION_HOURS
                    drive_since_break = 0.0
                    continue

                if drive_avail_fuel <= 0.01:
                    # Fuel Stop
                    fuel_event = HOSEvent(
                        start_time=current_time,
                        end_time=current_time + timedelta(hours=cls.FUEL_DURATION_HOURS),
                        status="ON_DUTY_NOT_DRIVING",
                        activity="Fuel Stop",
                        location=f"Fuel Station (Mile {total_odometer:.0f})",
                        remarks=f"Refueled tractor at mile {total_odometer:.0f}",
                        odometer_start=total_odometer,
                        odometer_end=total_odometer,
                    )
                    events.append(fuel_event)
                    current_time = fuel_event.end_time
                    shift_window += cls.FUEL_DURATION_HOURS
                    cycle_used += cls.FUEL_DURATION_HOURS
                    odometer_since_fuel = 0.0
                    drive_since_break = 0.0  # 30-min on-duty fueling qualifies as a break
                    continue

                # Drive for the maximum feasible chunk
                hours_needed_for_remaining = remaining_leg_miles / speed
                drive_chunk_hours = min(
                    hours_needed_for_remaining,
                    drive_avail_break,
                    drive_avail_shift,
                    drive_avail_window,
                    drive_avail_cycle,
                    drive_avail_fuel
                )

                # Ensure drive chunk is meaningful
                drive_chunk_hours = max(0.01, drive_chunk_hours)
                drive_miles = min(remaining_leg_miles, drive_chunk_hours * speed)

                start_odo = total_odometer
                end_odo = total_odometer + drive_miles

                drive_event = HOSEvent(
                    start_time=current_time,
                    end_time=current_time + timedelta(hours=drive_chunk_hours),
                    status="DRIVING",
                    activity=f"Driving towards {leg_name}",
                    location=f"Highway en route to {leg_name}",
                    remarks=f"Driving leg to {leg_name} ({drive_miles:.1f} mi)",
                    odometer_start=start_odo,
                    odometer_end=end_odo,
                )
                events.append(drive_event)

                current_time = drive_event.end_time
                remaining_leg_miles -= drive_miles
                total_odometer = end_odo
                shift_driving += drive_chunk_hours
                shift_window += drive_chunk_hours
                drive_since_break += drive_chunk_hours
                cycle_used += drive_chunk_hours
                odometer_since_fuel += drive_miles

            # End of Leg: Dwell Time (Pickup or Dropoff)
            dwell_event = HOSEvent(
                start_time=current_time,
                end_time=current_time + timedelta(hours=dwell_hours),
                status="ON_DUTY_NOT_DRIVING",
                activity=dwell_activity,
                location=leg_name,
                remarks=f"{dwell_activity} at {leg_name} (1.0 hr dwell)",
                odometer_start=total_odometer,
                odometer_end=total_odometer,
            )
            events.append(dwell_event)
            current_time = dwell_event.end_time
            shift_window += dwell_hours
            cycle_used += dwell_hours
            drive_since_break = 0.0  # 1 hour non-driving dwell satisfies 30-min break requirement

        return events
