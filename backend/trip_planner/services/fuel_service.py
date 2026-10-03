"""
Fuel Stop Management Service.
Mandate: Fueling at least once every 1,000 miles.
"""
from typing import List, Dict, Any, Tuple
import math


def interpolate_coordinate_at_fraction(coords: List[List[float]], fraction: float) -> Tuple[float, float]:
    """
    Finds [lng, lat] along a polyline at a given normalized distance fraction (0.0 to 1.0).
    """
    if not coords:
        return (0.0, 0.0)
    if len(coords) == 1 or fraction <= 0.0:
        return (coords[0][0], coords[0][1])
    if fraction >= 1.0:
        return (coords[-1][0], coords[-1][1])

    # Calculate cumulative segment lengths with latitude spherical projection
    seg_lengths = []
    total_len = 0.0
    for i in range(len(coords) - 1):
        mid_lat_rad = math.radians((coords[i][1] + coords[i+1][1]) / 2.0)
        dx = (coords[i+1][0] - coords[i][0]) * math.cos(mid_lat_rad)
        dy = coords[i+1][1] - coords[i][1]
        dist = math.hypot(dx, dy)
        seg_lengths.append(dist)
        total_len += dist

    if total_len == 0.0:
        return (coords[0][0], coords[0][1])

    target_dist = total_len * fraction
    accum = 0.0
    for i, seg in enumerate(seg_lengths):
        if accum + seg >= target_dist:
            sub_frac = (target_dist - accum) / seg if seg > 0 else 0.0
            lng = coords[i][0] + (coords[i+1][0] - coords[i][0]) * sub_frac
            lat = coords[i][1] + (coords[i+1][1] - coords[i][1]) * sub_frac
            return (round(lng, 5), round(lat, 5))
        accum += seg

    return (coords[-1][0], coords[-1][1])


class FuelService:
    MAX_FUEL_INTERVAL_MILES = 1000.0
    FUELING_DURATION_HOURS = 0.5  # 30 minutes on-duty not driving

    @classmethod
    def calculate_fuel_stops(
        cls,
        total_distance_miles: float,
        route_coordinates: List[List[float]]
    ) -> List[Dict[str, Any]]:
        """
        Determines if and where fuel stops are required based on the 1,000-mile rule.
        Returns a list of fuel stop objects with mile marker, duration, and coordinates.
        """
        fuel_stops = []
        if total_distance_miles <= cls.MAX_FUEL_INTERVAL_MILES:
            return fuel_stops

        # Number of fuel stops required
        num_stops = int(total_distance_miles // cls.MAX_FUEL_INTERVAL_MILES)
        for i in range(1, num_stops + 1):
            mile_marker = i * cls.MAX_FUEL_INTERVAL_MILES
            fraction = mile_marker / total_distance_miles
            lng, lat = interpolate_coordinate_at_fraction(route_coordinates, fraction)

            fuel_stops.append({
                "stop_number": i,
                "mile_marker": round(mile_marker, 1),
                "name": f"Fuel Stop #{i} (Mile {int(mile_marker)})",
                "duration_hours": cls.FUELING_DURATION_HOURS,
                "duty_status": "ON_DUTY_NOT_DRIVING",
                "coordinates": {"lat": lat, "lng": lng}
            })

        return fuel_stops
