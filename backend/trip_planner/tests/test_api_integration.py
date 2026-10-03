"""
Integration tests for Trip Planning API endpoints:
- POST /api/v1/trips/plan/
- GET /api/v1/trips/health/
"""
import pytest
from rest_framework.test import APIClient
from rest_framework import status


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
def test_health_check_endpoint(api_client):
    response = api_client.get('/api/v1/trips/health/')
    assert response.status_code == status.HTTP_200_OK
    assert response.data["status"] == "healthy"


@pytest.mark.django_db
def test_plan_trip_api_success(api_client):
    """
    Test end-to-end trip planning with valid payload.
    """
    payload = {
        "current_location": "Dallas, TX",
        "pickup_location": "Nashville, TN",
        "dropoff_location": "Seattle, WA",
        "current_cycle_used": 15.5,
        "departure_time": "2026-10-05T08:00:00Z",
        "carrier_name": "Spotter Logistics",
        "truck_number": "TRK-990",
        "trailer_number": "TRL-440",
    }
    response = api_client.post('/api/v1/trips/plan/', data=payload, format='json')
    assert response.status_code == status.HTTP_200_OK

    data = response.data
    assert "trip_id" in data
    assert "summary" in data
    assert data["summary"]["total_distance_miles"] > 1000.0
    assert data["summary"]["num_daily_logs"] >= 3

    assert "route_geometry" in data
    assert data["route_geometry"]["type"] == "LineString"
    assert len(data["route_geometry"]["coordinates"]) > 0

    assert "stops" in data
    assert len(data["stops"]) >= 3  # Origin, Pickup, Dropoff + Fuel Stops

    assert "daily_logs" in data
    assert len(data["daily_logs"]) >= 3
    for log in data["daily_logs"]:
        assert log["totals"]["total_hours"] == 24.00
        assert "graph_segments" in log


@pytest.mark.django_db
def test_plan_trip_api_validation_errors(api_client):
    """
    Test validation errors on missing or invalid inputs.
    """
    # Missing dropoff location
    payload = {
        "current_location": "Dallas, TX",
        "pickup_location": "Nashville, TN",
        "current_cycle_used": 15.5
    }
    response = api_client.post('/api/v1/trips/plan/', data=payload, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST

    # Negative cycle used
    payload = {
        "current_location": "Dallas, TX",
        "pickup_location": "Nashville, TN",
        "dropoff_location": "Seattle, WA",
        "current_cycle_used": -5.0
    }
    response = api_client.post('/api/v1/trips/plan/', data=payload, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST
