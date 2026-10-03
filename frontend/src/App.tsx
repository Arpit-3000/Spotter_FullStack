import React, { useState, useEffect } from 'react';
import type { TripPlanRequest, TripPlanResponse } from './types/trip';
import { planTrip } from './api/client';
import { TripInputForm } from './components/TripInputForm';
import { TripSummaryCards } from './components/TripSummaryCards';
import { RouteMap } from './components/RouteMap';
import { DailyLogViewer } from './components/DailyLogViewer';
import { StopTimeline } from './components/StopTimeline';
import {
  Truck,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Map,
  X,
} from 'lucide-react';

export const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [tripData, setTripData] = useState<TripPlanResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'logs' | 'map'>('logs');

  // Initial demonstration trip calculation
  useEffect(() => {
    handleCalculateTrip({
      current_location: 'Dallas, TX',
      pickup_location: 'Nashville, TN',
      dropoff_location: 'Seattle, WA',
      current_cycle_used: 15.5,
      carrier_name: 'Spotter Logistics LLC',
      truck_number: 'TRK-9042',
      trailer_number: 'TRL-5301',
    });
  }, []);

  const handleCalculateTrip = async (request: TripPlanRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await planTrip(request);
      setTripData(response);
    } catch (err: any) {
      console.error('Trip dispatch failed:', err);
      setError(err.message || 'An unexpected error occurred while planning the trip.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-12">
      {/* Top Professional Dispatch Navigation */}
      <header className="bg-slate-900 text-white border-b border-slate-800 shadow-sm print:hidden">
        <div className="max-w-[1440px] mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white shadow">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white m-0 leading-tight">
                SPOTTER FREIGHT &bull; HOS TRIP DISPATCH &amp; ELD PLANNER
              </h1>
              <span className="text-[11px] text-slate-400 font-medium">
                Commercial Motor Vehicle Hours of Service (49 CFR § 395) &bull; 70h/8d Standard
              </span>
            </div>
          </div>

          {/* Compliance & Engine Status Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              FMCSA Rulebook 2020
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              Live OSRM Routing Engine
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Django API Connected
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace Container */}
      <main className="max-w-[1440px] mx-auto px-4 py-5 space-y-5">
        {/* Error Alert Banner */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-800 flex items-start justify-between gap-3 shadow-sm print:hidden">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-rose-900">Trip Dispatch Error:</strong>
                <p className="mt-0.5">{error}</p>
                <p className="mt-1 text-[11px] text-rose-600">
                  Please verify input locations (e.g., "City, State") or ensure the Django backend server is running on port 8000.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-500 hover:text-rose-800 cursor-pointer p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Trip Dispatch Input Form */}
        <TripInputForm onSubmit={handleCalculateTrip} isLoading={isLoading} />

        {/* Dynamic Trip Results Section */}
        {tripData && (
          <div className="space-y-5">
            {/* KPI Summary Tiles */}
            <div className="print:hidden">
              <TripSummaryCards summary={tripData.summary} />
            </div>

            {/* Navigation Tabs (Logs vs. Map) */}
            <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-2 flex items-center justify-between print:hidden">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('logs')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'logs'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Daily Driver Logs &amp; 24h Graph</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeTab === 'logs' ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-800'
                  }`}>
                    {tripData.daily_logs.length} Days
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('map')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'map'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Map className="w-4 h-4" />
                  <span>Interactive Map &amp; Itinerary</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeTab === 'map' ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-800'
                  }`}>
                    {tripData.stops.length} Stops
                  </span>
                </button>
              </div>

              <div className="text-xs text-slate-500 font-mono hidden sm:block">
                Trip ID: <span className="font-semibold text-slate-700">{tripData.trip_id.slice(0, 8)}</span>
              </div>
            </div>

            {/* Active Tab Workspace */}
            {activeTab === 'logs' ? (
              <DailyLogViewer dailyLogs={tripData.daily_logs} />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2">
                  <RouteMap routeGeometry={tripData.route_geometry} stops={tripData.stops} />
                </div>
                <div className="lg:col-span-1">
                  <StopTimeline stops={tripData.stops} events={tripData.timeline_events} />
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
