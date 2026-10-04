# Spotter — HOS Trip Dispatcher & Driver Daily Log Generator

A full-stack logistics application that calculates driving routes, plans FMCSA Hours of Service (HOS) compliant driver schedules with required rest and fuel stops, and generates 24-hour Electronic Logging Device (ELD) daily log sheets with an interactive 4-row duty status graph.

---

## Live Links

- **Frontend (Vercel):** [https://spotter-full-stack-eta.vercel.app/](https://spotter-full-stack-eta.vercel.app/)
- **Backend API (Render):** [https://spotter-fullstack-tzvu.onrender.com](https://spotter-fullstack-tzvu.onrender.com)
- **API Health Check:** [https://spotter-fullstack-tzvu.onrender.com/api/v1/trips/health/](https://spotter-fullstack-tzvu.onrender.com/api/v1/trips/health/)
- **Loom Demo Video:** `https://www.loom.com/share/476eeb145ced463fa2f456862a6f0615`

---

## What It Does

Given a driver's starting point, pickup location, dropoff location, and the current cycle hours already used, the system:
1. Geocodes locations and generates driving routes and waypoints via OSRM and OpenStreetMap.
2. Injects required stops along the route based on real distances and timestamps:
   - 1 hour on-duty loading at pickup
   - 1 hour on-duty unloading at dropoff
   - 30-minute fuel stops at or before every 1,000 miles
   - 30-minute off-duty rest breaks before 8 hours of continuous driving
   - 10-hour consecutive rest periods before exceeding 11 hours driving or 14 hours on duty
   - 34-hour restarts when approaching the 70-hour / 8-day cycle cap
3. Splits multi-day trips into calendar days (00:00:00 to 24:00:00) where every single day sums to exactly 24.00 hours across the 4 standard duty statuses.
4. Renders the route and all stops on an interactive Leaflet map alongside a minute-precise SVG daily log sheet matching standard FMCSA paper logs.

No mock or hardcoded trip outputs are used — all calculations, waypoints, and event schedules are generated dynamically by the backend API.

---

## FMCSA 49 CFR Part 395 Rules Implemented

- **11-Hour Driving Limit (§ 395.3(a)(3)(i)):** Driver cannot drive more than 11 hours after 10 consecutive hours off duty.
- **14-Hour Consecutive Duty Window (§ 395.3(a)(2)):** Driving is not permitted beyond the 14th consecutive hour after coming on duty.
- **30-Minute Rest Break (§ 395.3(a)(3)(ii)):** Driver must take at least 30 consecutive minutes off-duty if more than 8 hours of driving have passed without a qualifying break.
- **10-Hour Consecutive Off-Duty (§ 395.3(a)(1)):** Fully resets both the 11-hour driving limit and 14-hour duty window.
- **70-Hour / 8-Day Cycle (§ 395.3(b)(1)):** Driver cannot drive after 70 cumulative on-duty hours in any rolling 8-day period.
- **34-Hour Restart (§ 395.3(d)):** 34 consecutive hours off-duty/sleeper berth resets the cumulative 70-hour cycle to 0.
- **Fueling Rule:** 30 minutes on-duty fueling stop at least once every 1,000 miles.
- **Dwell Times:** 1 hour on-duty not driving for loading at pickup, and 1 hour for unloading at dropoff.
- **Strict 24-Hour Balance:** Multi-day activities that span across midnight are split into distinct segments so every individual log sheet accounts for exactly 24.00 hours.

---

## Tech Stack

- **Backend:** Python 3.12, Django 6.1, Django REST Framework, Gunicorn, pytest
- **Frontend:** React 19, TypeScript, Vite 5, Leaflet, Lucide Icons, Pure CSS
- **APIs:** OpenStreetMap Nominatim (Geocoding), OSRM (Turn-by-turn routing & coordinates)
- **Deployment:** Render (Backend Web Service), Vercel (Frontend SPA)

---

## Local Setup & Run Guide

### Prerequisites
- Python 3.10 or higher
- Node.js 18 or higher (with npm)
- Git

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/Spotter_FullStack.git
cd Spotter_FullStack
```

### 2. Backend Setup (Django)

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
.\venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Start backend server
python manage.py runserver 127.0.0.1:8000
```
Backend will be live at `http://127.0.0.1:8000/`.  
Health check endpoint: `http://127.0.0.1:8000/api/v1/trips/health/`

### 3. Frontend Setup (React + Vite)

Open a new terminal window:

```bash
cd frontend

# Install packages
npm install

# Start Vite dev server
npm run dev
```
Frontend will be live at `http://127.0.0.1:5173/`.

To connect the local frontend to the production Render backend instead of localhost, update `frontend/.env`:
```env
VITE_API_BASE_URL=https://spotter-fullstack-tzvu.onrender.com
```

---

## Running Tests

### Backend Tests
The backend includes 17 automated unit and integration tests covering short trips, multi-day routes, 11-hour driving limits, 14-hour duty windows, 30-minute breaks, 70-hour cycle resets, 34-hour restarts, fuel stop placement, and midnight splitting.

```bash
cd backend
pytest
```

Expected output:
```text
trip_planner/tests/test_api_integration.py ...      [ 17%]
trip_planner/tests/test_daily_logs.py .....         [ 47%]
trip_planner/tests/test_hos_rules.py .........      [100%]

==================== 17 passed in 4.90s ====================
```

### Frontend Build & Lint Check
```bash
cd frontend
npm run build
```

---

## API Reference

### `POST /api/v1/trips/plan/`

#### Request Body
```json
{
  "current_location": "Dallas, TX",
  "pickup_location": "Oklahoma City, OK",
  "dropoff_location": "Denver, CO",
  "current_cycle_used_hours": 24.5,
  "trip_start_time": "2026-10-05T06:00:00Z"
}
```

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `current_location` | string | Yes | City/State or "lat, lon" starting coordinate |
| `pickup_location` | string | Yes | Shipper / pickup location |
| `dropoff_location` | string | Yes | Consignee / delivery location |
| `current_cycle_used_hours` | float | No | Accumulated duty hours in 70h cycle (0.0 - 70.0, default: 0.0) |
| `trip_start_time` | string | No | Departure time in ISO 8601 format (defaults to current time) |

#### Response Structure
```json
{
  "trip_summary": {
    "total_distance_miles": 948.2,
    "total_driving_duration_hours": 14.8,
    "total_trip_duration_hours": 27.3,
    "start_time": "2026-10-05T06:00:00Z",
    "estimated_completion_time": "2026-10-06T09:18:00Z",
    "total_days": 2,
    "total_fuel_stops": 0,
    "total_rest_stops": 1
  },
  "legs": [...],
  "schedule_events": [...],
  "daily_logs": [
    {
      "day_number": 1,
      "date": "2026-10-05",
      "total_hours": 24.0,
      "duty_totals": {
        "OFF_DUTY": 10.0,
        "SLEEPER_BERTH": 0.0,
        "DRIVING": 10.5,
        "ON_DUTY_ND": 3.5
      },
      "recap": {
        "cycle_hours_used": 38.5,
        "cycle_hours_available": 31.5
      },
      "events": [...]
    }
  ]
}
```

---

## Project Structure

```
Spotter_FullStack/
├── README.md
├── assessment_docs/             # Assessment guidelines and reference sheets
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── spotter_project/         # Django settings, WSGI, URLs
│   │   ├── settings.py
│   │   └── urls.py
│   └── trip_planner/            # Core logic & HOS scheduler
│       ├── serializers.py       # Input validation
│       ├── views.py             # API endpoints
│       ├── services/
│       │   ├── geocoding_service.py   # Nominatim integration
│       │   ├── routing_service.py     # OSRM route calculations
│       │   ├── fuel_service.py        # 1,000-mile fuel stop logic
│       │   ├── hos_scheduler.py       # FMCSA Part 395 scheduler engine
│       │   ├── daily_log_service.py   # Midnight slicing & 24h totals
│       │   └── trip_orchestrator.py   # Pipeline runner
│       └── tests/                     # 17 automated pytest cases
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── src/
    │   ├── api/client.ts              # API client
    │   ├── components/
    │   │   ├── TripInputForm.tsx      # Dispatch input form
    │   │   ├── TripSummaryCards.tsx   # Trip summary stats
    │   │   ├── RouteMap.tsx           # Leaflet interactive map
    │   │   ├── DailyLogViewer.tsx     # Multi-day tabs & layout
    │   │   ├── DailyLogGraph.tsx      # SVG 4-row FMCSA duty grid
    │   │   ├── EventTable.tsx         # Chronological event log
    │   │   └── StopTimeline.tsx       # Stop-by-stop itinerary
    │   ├── types/trip.ts
    │   └── index.css
```
