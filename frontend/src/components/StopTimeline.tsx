import React from 'react';
import type { HOSEvent, Stop } from '../types/trip';
import { MapPin, Fuel, Coffee, CheckCircle2 } from 'lucide-react';

interface StopTimelineProps {
  stops: Stop[];
  events: HOSEvent[];
}

export const StopTimeline: React.FC<StopTimelineProps> = ({ stops, events }) => {

  return (
    <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600" />
          Trip Itinerary & Operational Stops
        </h3>
        <span className="text-xs text-slate-500 font-medium font-mono">
          {stops.length} Map Waypoints &bull; {events.length} Total Events
        </span>
      </div>

      <div className="mt-4 relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {stops.map((stop, index) => {
          let icon = <MapPin className="w-3.5 h-3.5 text-blue-600" />;
          let badgeBg = 'bg-blue-50 text-blue-800 border-blue-200';

          if (stop.type === 'origin') {
            icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
            badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
          } else if (stop.type === 'pickup') {
            icon = <Coffee className="w-3.5 h-3.5 text-sky-600" />;
            badgeBg = 'bg-sky-50 text-sky-800 border-sky-200';
          } else if (stop.type === 'fuel') {
            icon = <Fuel className="w-3.5 h-3.5 text-amber-600" />;
            badgeBg = 'bg-amber-50 text-amber-800 border-amber-200';
          } else if (stop.type === 'dropoff') {
            icon = <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />;
            badgeBg = 'bg-rose-50 text-rose-800 border-rose-200';
          }

          return (
            <div key={stop.id || index} className="relative flex items-start gap-3 text-xs">
              <span className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border border-slate-300 flex items-center justify-center shadow-sm">
                {icon}
              </span>
              <div className="flex-1 bg-slate-50 rounded-md p-2.5 border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 text-xs">{stop.name}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badgeBg} uppercase`}>
                    {stop.type}
                  </span>
                </div>
                <div className="text-slate-600 mt-1">{stop.location}</div>
                <div className="text-slate-400 font-mono text-[10px] mt-0.5">
                  GPS: {stop.coordinates.lat.toFixed(4)}, {stop.coordinates.lng.toFixed(4)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
