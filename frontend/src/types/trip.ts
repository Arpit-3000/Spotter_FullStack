export type DutyStatus = 'OFF_DUTY' | 'SLEEPER_BERTH' | 'DRIVING' | 'ON_DUTY_NOT_DRIVING';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Stop {
  id: string;
  type: 'origin' | 'pickup' | 'fuel' | 'dropoff';
  name: string;
  location: string;
  coordinates: Coordinates;
}

export interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][]; // [lng, lat]
}

export interface HOSEvent {
  id: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  status: DutyStatus;
  activity: string;
  location: string;
  remarks: string;
  odometer_start: number;
  odometer_end: number;
}

export interface GraphSegment {
  status: DutyStatus;
  line_number: number;
  hour_start: number;
  hour_end: number;
  canvas_x1: number;
  canvas_x2: number;
  canvas_y: number;
  activity: string;
  location: string;
}

export interface DailyLogTotals {
  off_duty_hours: number;
  sleeper_berth_hours: number;
  driving_hours: number;
  on_duty_not_driving_hours: number;
  total_hours: number; // Invariant: exactly 24.00
}

export interface DailyLogRecap {
  on_duty_today: number;
  hours_last_7_days: number;
  hours_available_tomorrow: number;
  hours_last_8_days: number;
}

export interface DailyLogSheet {
  day_number: number;
  date_string: string;
  from_location: string;
  to_location: string;
  carrier_name: string;
  truck_number: string;
  trailer_number: string;
  miles_driving_today: number;
  total_mileage_today: number;
  totals: DailyLogTotals;
  recap: DailyLogRecap;
  events: HOSEvent[];
  graph_segments: GraphSegment[];
}

export interface TripSummary {
  total_distance_miles: number;
  total_driving_hours: number;
  total_duty_hours: number;
  total_rest_hours: number;
  total_trip_hours: number;
  num_daily_logs: number;
  num_fuel_stops: number;
  trip_start_time: string;
  trip_end_time: string;
  routing_source: string;
}

export interface TripPlanResponse {
  trip_id: string;
  inputs: {
    current_location: string;
    pickup_location: string;
    dropoff_location: string;
    current_cycle_used: number;
  };
  summary: TripSummary;
  route_geometry: RouteGeometry;
  stops: Stop[];
  timeline_events: HOSEvent[];
  daily_logs: DailyLogSheet[];
}

export interface TripPlanRequest {
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  current_cycle_used: number;
  departure_time?: string;
  carrier_name?: string;
  truck_number?: string;
  trailer_number?: string;
}
