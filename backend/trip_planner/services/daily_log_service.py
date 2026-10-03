"""
Daily Log Generation Service.
Slices continuous multi-day HOS events into 24-hour midnight-to-midnight (00:00 to 24:00) log sheets.
Guarantees the strict FMCSA invariant:
Line 1 (Off Duty) + Line 2 (Sleeper) + Line 3 (Driving) + Line 4 (On Duty Not Driving) == 24.00 Hours.
Generates 70-hr / 8-day recap table and normalized graph grid coordinates for canvas/SVG rendering.
"""
from datetime import datetime, timedelta, timezone, date
from typing import List, Dict, Any, Tuple
import math
from .hos_scheduler import HOSEvent


STATUS_LINE_MAP = {
    "OFF_DUTY": 1,
    "SLEEPER_BERTH": 2,
    "DRIVING": 3,
    "ON_DUTY_NOT_DRIVING": 4,
}

# Image calibration constants for blank-paper-log.png (1000x1000 coordinate space)
CANVAS_GRID_X_START = 125.0
CANVAS_GRID_X_END = 885.0
CANVAS_GRID_WIDTH = CANVAS_GRID_X_END - CANVAS_GRID_X_START

CANVAS_GRID_Y_ROWS = {
    "OFF_DUTY": 368.0,
    "SLEEPER_BERTH": 405.0,
    "DRIVING": 442.0,
    "ON_DUTY_NOT_DRIVING": 478.0,
}


class DailyLogService:

    @classmethod
    def generate_daily_logs(
        cls,
        events: List[HOSEvent],
        from_location: str,
        to_location: str,
        carrier_name: str = "Spotter Freight Lines",
        truck_number: str = "TRK-101",
        trailer_number: str = "TRL-502",
        prior_cycle_used: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        Partitions an unbroken sequence of HOS events across multiple calendar days
        and returns a list of completed Daily Log sheets.
        """
        if not events:
            return []

        # Find min and max dates
        first_event = events[0]
        last_event = events[-1]

        start_date = first_event.start_time.date()
        end_date = last_event.end_time.date()

        # Step 1: Pre-pad initial day from midnight to first event with OFF_DUTY
        initial_midnight = datetime(start_date.year, start_date.month, start_date.day, 0, 0, 0, tzinfo=timezone.utc)
        all_events: List[HOSEvent] = []

        if first_event.start_time > initial_midnight:
            all_events.append(HOSEvent(
                start_time=initial_midnight,
                end_time=first_event.start_time,
                status="OFF_DUTY",
                activity="Pre-Trip Off Duty",
                location=from_location,
                remarks="Off Duty at home terminal prior to shift start",
                odometer_start=0.0,
                odometer_end=0.0,
            ))

        all_events.extend(events)

        # Step 2: Post-pad final day from last event to midnight with OFF_DUTY
        # If the trip ends exactly at midnight (00:00:00), the active date is the preceding day
        if last_event.end_time.time() == datetime.min.time() and last_event.end_time > first_event.start_time:
            effective_end_date = last_event.end_time.date() - timedelta(days=1)
        else:
            effective_end_date = last_event.end_time.date()

        final_midnight = datetime(effective_end_date.year, effective_end_date.month, effective_end_date.day, 0, 0, 0, tzinfo=timezone.utc) + timedelta(days=1)
        if last_event.end_time < final_midnight:
            all_events.append(HOSEvent(
                start_time=last_event.end_time,
                end_time=final_midnight,
                status="OFF_DUTY",
                activity="Post-Trip Off Duty",
                location=to_location,
                remarks="Off Duty at destination terminal following trip completion",
                odometer_start=last_event.odometer_end,
                odometer_end=last_event.odometer_end,
            ))

        # Step 3: Slice events that cross calendar midnights
        sliced_by_date: Dict[date, List[Dict[str, Any]]] = {}

        for ev in all_events:
            cur_start = ev.start_time
            cur_end = ev.end_time

            while cur_start < cur_end:
                cur_date = cur_start.date()
                next_midnight = datetime(cur_date.year, cur_date.month, cur_date.day, 0, 0, 0, tzinfo=timezone.utc) + timedelta(days=1)

                segment_end = min(cur_end, next_midnight)
                duration_hrs = (segment_end - cur_start).total_seconds() / 3600.0

                if cur_date not in sliced_by_date:
                    sliced_by_date[cur_date] = []

                # Proportional odometer allocation for driving across midnight
                ev_total_dur = (ev.end_time - ev.start_time).total_seconds() / 3600.0
                if ev_total_dur > 0 and ev.status == "DRIVING":
                    frac_start = (cur_start - ev.start_time).total_seconds() / (ev_total_dur * 3600.0)
                    frac_end = (segment_end - ev.start_time).total_seconds() / (ev_total_dur * 3600.0)
                    total_miles = ev.odometer_end - ev.odometer_start
                    seg_start_odo = ev.odometer_start + total_miles * frac_start
                    seg_end_odo = ev.odometer_start + total_miles * frac_end
                else:
                    seg_start_odo = ev.odometer_start
                    seg_end_odo = ev.odometer_end

                sliced_by_date[cur_date].append({
                    "start_time": cur_start.isoformat(),
                    "end_time": segment_end.isoformat(),
                    "duration_hours": round(duration_hrs, 4),
                    "status": ev.status,
                    "activity": ev.activity,
                    "location": ev.location,
                    "remarks": ev.remarks,
                    "odometer_start": round(seg_start_odo, 2),
                    "odometer_end": round(seg_end_odo, 2),
                })

                cur_start = segment_end

        # Step 4: Build DailyLogSheet for each calendar date
        sorted_dates = sorted(sliced_by_date.keys())
        daily_sheets = []
        historical_daily_on_duty = [prior_cycle_used]  # Seed with prior cycle on-duty history

        for day_index, dt in enumerate(sorted_dates, start=1):
            day_events = sliced_by_date[dt]

            # Check if a 34-hour restart completed on this day
            has_34h_restart = any("34-Hour" in ev.get("activity", "") for ev in day_events)
            if has_34h_restart:
                # 34-hour restart resets the prior 7/8-day rolling history under 49 CFR § 395.3(d)
                historical_daily_on_duty = []

            # Calculate totals for the 4 FMCSA rows
            line1_off_duty = 0.0
            line2_sleeper = 0.0
            line3_driving = 0.0
            line4_on_duty_not_driving = 0.0

            miles_driving_today = 0.0
            min_odo = 9999999.0
            max_odo = 0.0

            for ev in day_events:
                dur = ev["duration_hours"]
                status = ev["status"]
                if status == "OFF_DUTY":
                    line1_off_duty += dur
                elif status == "SLEEPER_BERTH":
                    line2_sleeper += dur
                elif status == "DRIVING":
                    line3_driving += dur
                    miles_driving_today += (ev["odometer_end"] - ev["odometer_start"])
                elif status == "ON_DUTY_NOT_DRIVING":
                    line4_on_duty_not_driving += dur

                min_odo = min(min_odo, ev["odometer_start"])
                max_odo = max(max_odo, ev["odometer_end"])

            # Ensure strict 24.0000 total hours invariant by balancing rounding on off_duty
            total_calc = line1_off_duty + line2_sleeper + line3_driving + line4_on_duty_not_driving
            diff = 24.0 - total_calc
            line1_off_duty += diff  # Balance slight floating-point discrepancies

            on_duty_today = round(line3_driving + line4_on_duty_not_driving, 2)
            historical_daily_on_duty.append(on_duty_today)

            # Rolling 70-hr recap calculations
            last_7_days_window = historical_daily_on_duty[-7:]
            hours_last_7_days = round(sum(last_7_days_window), 2)
            hours_available_tomorrow = round(max(0.0, 70.0 - hours_last_7_days), 2)
            last_8_days_window = historical_daily_on_duty[-8:]
            hours_last_8_days = round(sum(last_8_days_window), 2)

            # Generate grid drawing segments and normalized SVG coordinates
            graph_segments = []
            for ev in day_events:
                st = datetime.fromisoformat(ev["start_time"])
                et = datetime.fromisoformat(ev["end_time"])

                h_start = st.hour + st.minute / 60.0 + st.second / 3600.0
                h_end = et.hour + et.minute / 60.0 + et.second / 3600.0
                if h_end == 0.0 and et.date() > st.date():
                    h_end = 24.0

                x1_canvas = CANVAS_GRID_X_START + (h_start / 24.0) * CANVAS_GRID_WIDTH
                x2_canvas = CANVAS_GRID_X_START + (h_end / 24.0) * CANVAS_GRID_WIDTH
                y_canvas = CANVAS_GRID_Y_ROWS[ev["status"]]

                graph_segments.append({
                    "status": ev["status"],
                    "line_number": STATUS_LINE_MAP[ev["status"]],
                    "hour_start": round(h_start, 3),
                    "hour_end": round(h_end, 3),
                    "canvas_x1": round(x1_canvas, 2),
                    "canvas_x2": round(x2_canvas, 2),
                    "canvas_y": round(y_canvas, 2),
                    "activity": ev["activity"],
                    "location": ev["location"],
                })

            sheet = {
                "day_number": day_index,
                "date_string": dt.isoformat(),
                "from_location": from_location,
                "to_location": to_location,
                "carrier_name": carrier_name,
                "truck_number": truck_number,
                "trailer_number": trailer_number,
                "miles_driving_today": round(miles_driving_today, 1),
                "total_mileage_today": round(max_odo, 1),
                "totals": {
                    "off_duty_hours": round(line1_off_duty, 2),
                    "sleeper_berth_hours": round(line2_sleeper, 2),
                    "driving_hours": round(line3_driving, 2),
                    "on_duty_not_driving_hours": round(line4_on_duty_not_driving, 2),
                    "total_hours": 24.00,  # DOT Mandatory Invariant
                },
                "recap": {
                    "on_duty_today": on_duty_today,
                    "hours_last_7_days": hours_last_7_days,
                    "hours_available_tomorrow": hours_available_tomorrow,
                    "hours_last_8_days": hours_last_8_days,
                },
                "events": day_events,
                "graph_segments": graph_segments,
            }
            daily_sheets.append(sheet)

        return daily_sheets
