import React, { useState } from 'react';
import type { TripPlanRequest } from '../types/trip';
import { Truck, MapPin, Clock, ArrowRight, Settings2, Sparkles, Loader2 } from 'lucide-react';

interface TripInputFormProps {
  onSubmit: (data: TripPlanRequest) => void;
  isLoading: boolean;
}

const PRESET_TRIPS: { label: string; data: TripPlanRequest }[] = [
  {
    label: 'Cross-Country Haul (3,000+ mi)',
    data: {
      current_location: 'Dallas, TX',
      pickup_location: 'Nashville, TN',
      dropoff_location: 'Seattle, WA',
      current_cycle_used: 15.5,
      carrier_name: 'Spotter Logistics LLC',
      truck_number: 'TRK-9042',
      trailer_number: 'TRL-5301',
    },
  },
  {
    label: 'Eastern Corridor (1,300+ mi)',
    data: {
      current_location: 'Chicago, IL',
      pickup_location: 'Atlanta, GA',
      dropoff_location: 'Miami, FL',
      current_cycle_used: 5.0,
      carrier_name: 'Great Lakes Express',
      truck_number: 'TRK-2210',
      trailer_number: 'TRL-8840',
    },
  },
  {
    label: 'Cycle Limit / 34h Restart Test (66.5h Cycle)',
    data: {
      current_location: 'Denver, CO',
      pickup_location: 'Kansas City, MO',
      dropoff_location: 'Indianapolis, IN',
      current_cycle_used: 66.5,
      carrier_name: 'Midwest Freightways',
      truck_number: 'TRK-3011',
      trailer_number: 'TRL-1902',
    },
  },
  {
    label: 'Short Single-Day Haul (200 mi)',
    data: {
      current_location: 'Dallas, TX',
      pickup_location: 'Fort Worth, TX',
      dropoff_location: 'Waco, TX',
      current_cycle_used: 10.0,
      carrier_name: 'Lone Star Courier',
      truck_number: 'TRK-105',
      trailer_number: 'TRL-204',
    },
  },
];

export const TripInputForm: React.FC<TripInputFormProps> = ({ onSubmit, isLoading }) => {
  const [currentLocation, setCurrentLocation] = useState('Dallas, TX');
  const [pickupLocation, setPickupLocation] = useState('Nashville, TN');
  const [dropoffLocation, setDropoffLocation] = useState('Seattle, WA');
  const [currentCycleUsed, setCurrentCycleUsed] = useState<string>('15.5');
  const [departureTime, setDepartureTime] = useState<string>('');
  const [carrierName, setCarrierName] = useState('Spotter Logistics LLC');
  const [truckNumber, setTruckNumber] = useState('TRK-9042');
  const [trailerNumber, setTrailerNumber] = useState('TRL-5301');

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const loadPreset = (preset: typeof PRESET_TRIPS[0]) => {
    setCurrentLocation(preset.data.current_location);
    setPickupLocation(preset.data.pickup_location);
    setDropoffLocation(preset.data.dropoff_location);
    setCurrentCycleUsed(String(preset.data.current_cycle_used));
    if (preset.data.carrier_name) setCarrierName(preset.data.carrier_name);
    if (preset.data.truck_number) setTruckNumber(preset.data.truck_number);
    if (preset.data.trailer_number) setTrailerNumber(preset.data.trailer_number);
    setValidationErrors({});
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!currentLocation.trim()) errors.current_location = 'Current location is required.';
    if (!pickupLocation.trim()) errors.pickup_location = 'Pickup location is required.';
    if (!dropoffLocation.trim()) errors.dropoff_location = 'Dropoff location is required.';

    const cycleNum = parseFloat(currentCycleUsed);
    if (isNaN(cycleNum) || cycleNum < 0) {
      errors.current_cycle_used = 'Cycle used must be a positive number of hours (0 to 70+).';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: TripPlanRequest = {
      current_location: currentLocation.trim(),
      pickup_location: pickupLocation.trim(),
      dropoff_location: dropoffLocation.trim(),
      current_cycle_used: parseFloat(currentCycleUsed) || 0.0,
      carrier_name: carrierName.trim() || 'Spotter Logistics LLC',
      truck_number: truckNumber.trim() || 'TRK-101',
      trailer_number: trailerNumber.trim() || 'TRL-502',
    };

    if (departureTime) {
      payload.departure_time = new Date(departureTime).toISOString();
    }

    onSubmit(payload);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 print:hidden">
      {/* Quick Fill Presets Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-200">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          Quick Test Presets:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_TRIPS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => loadPreset(preset)}
              disabled={isLoading}
              className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded border border-slate-200 transition-colors cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Main 4 Assessment Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Current Location */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              1. Current Location
            </label>
            <input
              type="text"
              value={currentLocation}
              onChange={(e) => setCurrentLocation(e.target.value)}
              placeholder="e.g. Dallas, TX or Lat,Lng"
              disabled={isLoading}
              className={`w-full px-3 py-2 text-xs rounded border ${
                validationErrors.current_location ? 'border-rose-500 bg-rose-50' : 'border-slate-300'
              } focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium text-slate-900`}
            />
            {validationErrors.current_location && (
              <span className="text-[10px] text-rose-600 mt-1 block">{validationErrors.current_location}</span>
            )}
          </div>

          {/* Pickup Location */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-sky-600" />
              2. Pickup Location (Shipper)
            </label>
            <input
              type="text"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              placeholder="e.g. Nashville, TN"
              disabled={isLoading}
              className={`w-full px-3 py-2 text-xs rounded border ${
                validationErrors.pickup_location ? 'border-rose-500 bg-rose-50' : 'border-slate-300'
              } focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium text-slate-900`}
            />
            {validationErrors.pickup_location && (
              <span className="text-[10px] text-rose-600 mt-1 block">{validationErrors.pickup_location}</span>
            )}
            <span className="text-[10px] text-slate-500 mt-0.5 block">Allocates 1.0 hr on-duty dwell</span>
          </div>

          {/* Dropoff Location */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-rose-600" />
              3. Dropoff Location (Receiver)
            </label>
            <input
              type="text"
              value={dropoffLocation}
              onChange={(e) => setDropoffLocation(e.target.value)}
              placeholder="e.g. Seattle, WA"
              disabled={isLoading}
              className={`w-full px-3 py-2 text-xs rounded border ${
                validationErrors.dropoff_location ? 'border-rose-500 bg-rose-50' : 'border-slate-300'
              } focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium text-slate-900`}
            />
            {validationErrors.dropoff_location && (
              <span className="text-[10px] text-rose-600 mt-1 block">{validationErrors.dropoff_location}</span>
            )}
            <span className="text-[10px] text-slate-500 mt-0.5 block">Allocates 1.0 hr on-duty dwell</span>
          </div>

          {/* Current Cycle Used (Hrs) */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              4. Current Cycle Used (Hrs)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.5"
                min="0"
                max="80"
                value={currentCycleUsed}
                onChange={(e) => setCurrentCycleUsed(e.target.value)}
                placeholder="0.0"
                disabled={isLoading}
                className={`w-full px-3 py-2 text-xs font-mono font-bold rounded border ${
                  validationErrors.current_cycle_used ? 'border-rose-500 bg-rose-50' : 'border-slate-300'
                } focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900`}
              />
              <span className="absolute right-3 top-2 text-[11px] text-slate-400 font-semibold">/ 70.0h</span>
            </div>
            {validationErrors.current_cycle_used && (
              <span className="text-[10px] text-rose-600 mt-1 block">{validationErrors.current_cycle_used}</span>
            )}
            <span className="text-[10px] text-slate-500 mt-0.5 block">70hr/8day rolling limit rule</span>
          </div>
        </div>

        {/* Collapsible Dispatch Metadata Drawer */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5" />
            {showAdvanced ? 'Hide Dispatch & Equipment Metadata' : 'Show Dispatch & Equipment Metadata'}
          </button>

          {showAdvanced && (
            <div className="mt-3 p-3 bg-slate-50 rounded-md border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Departure Datetime (UTC)</label>
                <input
                  type="datetime-local"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Motor Carrier</label>
                <input
                  type="text"
                  value={carrierName}
                  onChange={(e) => setCarrierName(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tractor / Unit #</label>
                <input
                  type="text"
                  value={truckNumber}
                  onChange={(e) => setTruckNumber(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-xs text-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Trailer #</label>
                <input
                  type="text"
                  value={trailerNumber}
                  onChange={(e) => setTrailerNumber(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 text-xs text-slate-800 font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit Dispatch Action */}
        <div className="flex items-center justify-end pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-xs font-bold text-white shadow transition-all cursor-pointer ${
              isLoading
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99]'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Computing Route &amp; Evaluating HOS Schedule...</span>
              </>
            ) : (
              <>
                <Truck className="w-4 h-4" />
                <span>Calculate Compliant Route &amp; Generate Logs</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
