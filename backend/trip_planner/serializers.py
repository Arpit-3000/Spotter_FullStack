"""
Django REST Framework serializers for Trip Planning.
"""
from rest_framework import serializers


class TripPlanRequestSerializer(serializers.Serializer):
    current_location = serializers.CharField(
        required=True,
        allow_blank=False,
        max_length=255,
        help_text="Starting location (e.g. 'Dallas, TX' or '32.7767, -96.7970')"
    )
    pickup_location = serializers.CharField(
        required=True,
        allow_blank=False,
        max_length=255,
        help_text="Pickup / Shipper location (e.g. 'Nashville, TN')"
    )
    dropoff_location = serializers.CharField(
        required=True,
        allow_blank=False,
        max_length=255,
        help_text="Dropoff / Receiver location (e.g. 'Seattle, WA')"
    )
    current_cycle_used = serializers.FloatField(
        required=True,
        min_value=0.0,
        max_value=80.0,
        help_text="Accumulated on-duty hours in the active 70hr/8day cycle"
    )
    departure_time = serializers.DateTimeField(
        required=False,
        allow_null=True,
        help_text="ISO 8601 departure timestamp (defaults to 08:00 UTC today)"
    )
    carrier_name = serializers.CharField(
        required=False,
        default="Spotter Freight Logistics",
        max_length=255
    )
    truck_number = serializers.CharField(
        required=False,
        default="TRK-101",
        max_length=50
    )
    trailer_number = serializers.CharField(
        required=False,
        default="TRL-502",
        max_length=50
    )

    def validate_current_location(self, value):
        if not value.strip():
            raise serializers.ValidationError("Current location cannot be empty.")
        return value.strip()

    def validate_pickup_location(self, value):
        if not value.strip():
            raise serializers.ValidationError("Pickup location cannot be empty.")
        return value.strip()

    def validate_dropoff_location(self, value):
        if not value.strip():
            raise serializers.ValidationError("Dropoff location cannot be empty.")
        return value.strip()
