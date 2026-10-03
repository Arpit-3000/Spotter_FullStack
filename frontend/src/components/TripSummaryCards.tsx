import React from 'react';
import type { TripSummary } from '../types/trip';
import { Navigation, Clock, Fuel, ShieldCheck, FileText } from 'lucide-react';

interface TripSummaryCardsProps {
  summary: TripSummary;
}

export const TripSummaryCards: React.FC<TripSummaryCardsProps> = ({ summary }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {/* Total Distance */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Route Distance</span>
          <Navigation className="w-4 h-4 text-blue-600" />
        </div>
        <div className="mt-2">
          <div className="text-xl font-bold font-mono text-slate-900">
            {summary.total_distance_miles.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">Statute Miles</div>
        </div>
      </div>

      {/* Driving Hours */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Driving Time</span>
          <Clock className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="mt-2">
          <div className="text-xl font-bold font-mono text-emerald-800">
            {summary.total_driving_hours.toFixed(1)}h
          </div>
          <div className="text-[11px] text-slate-500 font-medium">Line 3 (Under 11h/shift)</div>
        </div>
      </div>

      {/* Total On-Duty Time */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Total On-Duty</span>
          <ShieldCheck className="w-4 h-4 text-amber-600" />
        </div>
        <div className="mt-2">
          <div className="text-xl font-bold font-mono text-amber-900">
            {summary.total_duty_hours.toFixed(1)}h
          </div>
          <div className="text-[11px] text-slate-500 font-medium">Drive + PTI + Dwell + Fuel</div>
        </div>
      </div>

      {/* Total Rest Time */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Rest / Sleeper</span>
          <Clock className="w-4 h-4 text-indigo-600" />
        </div>
        <div className="mt-2">
          <div className="text-xl font-bold font-mono text-indigo-900">
            {summary.total_rest_hours.toFixed(1)}h
          </div>
          <div className="text-[11px] text-slate-500 font-medium">10h Rests &amp; 30m Breaks</div>
        </div>
      </div>

      {/* Total Elapsed Hours */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Elapsed Trip</span>
          <Clock className="w-4 h-4 text-slate-700" />
        </div>
        <div className="mt-2">
          <div className="text-xl font-bold font-mono text-slate-900">
            {summary.total_trip_hours.toFixed(1)}h
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            {(summary.total_trip_hours / 24.0).toFixed(1)} Days Total
          </div>
        </div>
      </div>

      {/* Fuel Stops */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-[11px] font-semibold uppercase tracking-wider">Fuel Stops</span>
          <Fuel className="w-4 h-4 text-amber-600" />
        </div>
        <div className="mt-2">
          <div className="text-xl font-bold font-mono text-slate-900">
            {summary.num_fuel_stops}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">&le; 1,000 Mile Rule</div>
        </div>
      </div>

      {/* Log Sheets Count */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500">
          <span className="text-[11px] font-semibold uppercase tracking-wider">ELD Logs</span>
          <FileText className="w-4 h-4 text-blue-600" />
        </div>
        <div className="mt-2">
          <div className="text-xl font-bold font-mono text-blue-700">
            {summary.num_daily_logs}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">24h Log Sheets</div>
        </div>
      </div>
    </div>
  );
};
