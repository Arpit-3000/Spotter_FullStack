"""
Trip Planning Orchestrator Service.
Implements the exact pipeline:
request -> validation -> geocoding -> routing -> scheduler -> normalized events -> daily logs -> response
Keeps all business logic out of the Django view.
"""
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import uuid

from .geocoding_service import GeocodingService
from .routing_service import RoutingService
from .fuel_service import FuelService
from .hos_scheduler import HOSScheduler, HOSEvent
from .daily_log_service import DailyLogService


class TripOrchestrator:

    @classmethod
    def plan_trip(
        cls,
        current_location: str,
        pickup_location: str,
        dropoff_location: str,
        current_cycle_used: float,
        departure_time: Optional[datetime] = None,
        carrier_name: str = "Spotter Freight Logistics",
        truck_number: str = "TRK-708",
        trailer_number: str = "TRL-920",
    ) -> Dict[str, Any]:
        """
        Executes the full trip planning pipeline cleanly and returns a structured response payload.
        """
        # Step 1: Geocoding
        geo_current = GeocodingService.geocode(current_location)
        geo_pickup = GeocodingService.geocode(pickup_location)
        geo_dropoff = GeocodingService.geocode(dropoff_location)

        # Step 2: Routing
        # Leg 1: Current -> Pickup
        route_leg1 = RoutingService.calculate_route([
            {"lat": geo_current["lat"], "lng": geo_current["lng"]},
            {"lat": geo_pickup["lat"], "lng": geo_pickup["lng"]},
        ])

        # Leg 2: Pickup -> Dropoff
        route_leg2 = RoutingService.calculate_route([
            {"lat": geo_pickup["lat"], "lng": geo_pickup["lng"]},
            {"lat": geo_dropoff["lat"], "lng": geo_dropoff["lng"]},
        ])

        # Combine complete route geometry for map visualization
        combined_coords = []
        if route_leg1.get("geometry", {}).get("coordinates"):
            combined_coords.extend(route_leg1["geometry"]["coordinates"])
        if route_leg2.get("geometry", {}).get("coordinates"):
            combined_coords.extend(route_leg2["geometry"]["coordinates"])

        total_distance = round(route_leg1["distance_miles"] + route_leg2["distance_miles"], 2)
        total_driving_duration = round(route_leg1["duration_hours"] + route_leg2["duration_hours"], 2)

        # Step 3: Fuel stop calculation
        fuel_stops = FuelService.calculate_fuel_stops(total_distance, combined_coords)

        # Step 4: Construct legs for HOS Scheduler
        legs = [
            {
                "type": "deadhead",
                "name": f"Pickup ({geo_pickup['display_name']})",
                "distance_miles": route_leg1["distance_miles"],
                "duration_hours": route_leg1["duration_hours"],
            },
            {
                "type": "loaded",
                "name": f"Dropoff ({geo_dropoff['display_name']})",
                "distance_miles": route_leg2["distance_miles"],
                "duration_hours": route_leg2["duration_hours"],
            }
        ]

        # Step 5: HOS Scheduling Simulation
        hos_events = HOSScheduler.schedule_trip(
            legs=legs,
            current_cycle_used=current_cycle_used,
            start_time=departure_time,
            origin_name=geo_current["display_name"],
            pickup_name=geo_pickup["display_name"],
            dropoff_name=geo_dropoff["display_name"],
        )

        # Step 6: Daily Log Generation (Midnight-to-Midnight slicing)
        daily_logs = DailyLogService.generate_daily_logs(
            events=hos_events,
            from_location=geo_current["display_name"],
            to_location=geo_dropoff["display_name"],
            carrier_name=carrier_name,
            truck_number=truck_number,
            trailer_number=trailer_number,
            prior_cycle_used=current_cycle_used,
        )

        # Extract map stop markers with route_mile for chronological sorting
        stops = [
            {
                "id": "stop-origin",
                "type": "origin",
                "name": "Current Location",
                "location": geo_current["display_name"],
                "route_mile": 0.0,
                "coordinates": {"lat": geo_current["lat"], "lng": geo_current["lng"]},
            },
            {
                "id": "stop-pickup",
                "type": "pickup",
                "name": "Pickup Location (1h Loading)",
                "location": geo_pickup["display_name"],
                "route_mile": route_leg1["distance_miles"],
                "coordinates": {"lat": geo_pickup["lat"], "lng": geo_pickup["lng"]},
            }
        ]

        # Add fuel stops
        for fs in fuel_stops:
            stops.append({
                "id": f"stop-fuel-{fs['stop_number']}",
                "type": "fuel",
                "name": fs["name"],
                "location": f"Fuel Station (Mile {fs['mile_marker']})",
                "route_mile": fs["mile_marker"],
                "coordinates": fs["coordinates"],
            })

        stops.append({
            "id": "stop-dropoff",
            "type": "dropoff",
            "name": "Dropoff Location (1h Unloading)",
            "location": geo_dropoff["display_name"],
            "route_mile": total_distance,
            "coordinates": {"lat": geo_dropoff["lat"], "lng": geo_dropoff["lng"]},
        })

        # Ensure stops are strictly ordered by chronological journey distance
        stops.sort(key=lambda s: s["route_mile"])

        # Calculate high-level summary
        trip_start = hos_events[0].start_time
        trip_end = hos_events[-1].end_time
        total_trip_hours = round((trip_end - trip_start).total_seconds() / 3600.0, 2)

        total_driving_hours = round(sum(ev.duration_hours for ev in hos_events if ev.status == "DRIVING"), 2)
        total_on_duty_hours = round(sum(ev.duration_hours for ev in hos_events if ev.status in ("DRIVING", "ON_DUTY_NOT_DRIVING")), 2)
        total_rest_hours = round(sum(ev.duration_hours for ev in hos_events if ev.status in ("OFF_DUTY", "SLEEPER_BERTH")), 2)

        return {
            "trip_id": str(uuid.uuid4()),
            "inputs": {
                "current_location": current_location,
                "pickup_location": pickup_location,
                "dropoff_location": dropoff_location,
                "current_cycle_used": current_cycle_used,
            },
            "summary": {
                "total_distance_miles": total_distance,
                "total_driving_hours": total_driving_hours,
                "total_duty_hours": total_on_duty_hours,
                "total_rest_hours": total_rest_hours,
                "total_trip_hours": total_trip_hours,
                "num_daily_logs": len(daily_logs),
                "num_fuel_stops": len(fuel_stops),
                "trip_start_time": trip_start.isoformat(),
                "trip_end_time": trip_end.isoformat(),
                "routing_source": route_leg1.get("routing_source", "osrm_api")
            },
            "route_geometry": {
                "type": "LineString",
                "coordinates": combined_coords
            },
            "stops": stops,
            "timeline_events": [ev.to_dict() for ev in hos_events],
            "daily_logs": daily_logs
        }
