"""
API views for Trip Planning and HOS simulation.
Strictly acts as an HTTP orchestrator, delegating business logic to service layer.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import logging

from .serializers import TripPlanRequestSerializer
from .services.trip_orchestrator import TripOrchestrator

logger = logging.getLogger(__name__)


class TripPlanView(APIView):
    """
    POST /api/v1/trips/plan/
    Computes route, injects fuel stops, schedules FMCSA-compliant HOS timeline,
    and generates multi-day daily driver log sheets.
    """

    def post(self, request, *args, **kwargs):
        serializer = TripPlanRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "Validation failed", "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        data = serializer.validated_data

        try:
            plan_result = TripOrchestrator.plan_trip(
                current_location=data["current_location"],
                pickup_location=data["pickup_location"],
                dropoff_location=data["dropoff_location"],
                current_cycle_used=data["current_cycle_used"],
                departure_time=data.get("departure_time"),
                carrier_name=data.get("carrier_name", "Spotter Freight Logistics"),
                truck_number=data.get("truck_number", "TRK-101"),
                trailer_number=data.get("trailer_number", "TRL-502"),
            )
            return Response(plan_result, status=status.HTTP_200_OK)

        except ValueError as ve:
            logger.warning(f"Business logic error in trip planning: {ve}")
            return Response({"error": str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception(f"Unexpected error during trip planning: {e}")
            return Response(
                {"error": f"Internal trip planning error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class HealthCheckView(APIView):
    """
    GET /api/v1/trips/health/
    """
    def get(self, request, *args, **kwargs):
        return Response({"status": "healthy", "service": "spotter-hos-planner"}, status=status.HTTP_200_OK)
