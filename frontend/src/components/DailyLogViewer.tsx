import React, { useState } from 'react';
import type { DailyLogSheet } from '../types/trip';
import { DailyLogGraph } from './DailyLogGraph';
import { EventTable } from './EventTable';
import { Printer, Calendar, Truck, Clock } from 'lucide-react';

interface DailyLogViewerProps {
  dailyLogs: DailyLogSheet[];
}

export const DailyLogViewer: React.FC<DailyLogViewerProps> = ({ dailyLogs }) => {
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  if (!dailyLogs || dailyLogs.length === 0) {
    return null;
  }

  const currentSheet = dailyLogs[activeDayIndex] || dailyLogs[0];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Day Tabs */}
      <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Daily Driver Logs (FMCSA 24-Hour Sheets)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Trip requires {dailyLogs.length} consecutive daily log sheets &bull; All sheets audited to 24.00h DOT standard
            </p>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Daily Log Sheet (PDF)
          </button>
        </div>

        {/* Day Tabs */}
        <div className="flex flex-wrap gap-2 mt-3">
          {dailyLogs.map((sheet, index) => {
            const isActive = index === activeDayIndex;
            return (
              <button
                key={sheet.day_number}
                type="button"
                onClick={() => setActiveDayIndex(index)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>Day {sheet.day_number}</span>
                <span className="text-[11px] font-mono text-slate-500 font-normal">
                  ({sheet.date_string.slice(5)})
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Sheet Section (Printable Area) */}
      <div className="space-y-4 print:m-0 print:p-0">
        {/* Printable Header Info Box */}
        <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 uppercase font-semibold text-[10px]">Log Date</span>
              <div className="font-bold text-slate-800 text-sm mt-0.5">{currentSheet.date_string}</div>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-semibold text-[10px]">Driving Miles Today</span>
              <div className="font-bold text-blue-700 text-sm mt-0.5">{currentSheet.miles_driving_today.toFixed(1)} miles</div>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-semibold text-[10px]">Carrier Name</span>
              <div className="font-bold text-slate-800 text-sm mt-0.5 truncate" title={currentSheet.carrier_name}>
                {currentSheet.carrier_name}
              </div>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-semibold text-[10px]">Truck / Trailer</span>
              <div className="font-bold text-slate-800 text-sm mt-0.5">
                {currentSheet.truck_number} / {currentSheet.trailer_number}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600">
            <div><strong>From:</strong> {currentSheet.from_location}</div>
            <div><strong>To:</strong> {currentSheet.to_location}</div>
          </div>
        </div>

        {/* 24-Hour Graph Component */}
        <DailyLogGraph logSheet={currentSheet} />

        {/* Recap Table & 4-Line Hourly Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Subtotal Hours Box */}
          <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-500" />
              Daily Subtotal Hours Summary (Sum = 24.0h)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500 font-semibold uppercase">1. Off Duty</div>
                <div className="text-base font-bold text-slate-800 font-mono mt-1">
                  {currentSheet.totals.off_duty_hours.toFixed(2)}h
                </div>
              </div>
              <div className="p-2.5 rounded bg-indigo-50/60 border border-indigo-200">
                <div className="text-[10px] text-indigo-700 font-semibold uppercase">2. Sleeper</div>
                <div className="text-base font-bold text-indigo-900 font-mono mt-1">
                  {currentSheet.totals.sleeper_berth_hours.toFixed(2)}h
                </div>
              </div>
              <div className="p-2.5 rounded bg-emerald-50/60 border border-emerald-200">
                <div className="text-[10px] text-emerald-700 font-semibold uppercase">3. Driving</div>
                <div className="text-base font-bold text-emerald-900 font-mono mt-1">
                  {currentSheet.totals.driving_hours.toFixed(2)}h
                </div>
              </div>
              <div className="p-2.5 rounded bg-amber-50/60 border border-amber-200">
                <div className="text-[10px] text-amber-800 font-semibold uppercase">4. On Duty</div>
                <div className="text-base font-bold text-amber-900 font-mono mt-1">
                  {currentSheet.totals.on_duty_not_driving_hours.toFixed(2)}h
                </div>
              </div>
            </div>
          </div>

          {/* 70-Hour / 8-Day Recap Box */}
          <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-blue-600" />
              70-Hour / 8-Day Cycle Recap Table
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 rounded bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500 font-semibold">On Duty Today</div>
                <div className="text-sm font-bold text-slate-800 font-mono mt-1">
                  {currentSheet.recap.on_duty_today.toFixed(2)}h
                </div>
              </div>
              <div className="p-2 rounded bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500 font-semibold">Line A (Last 7d)</div>
                <div className="text-sm font-bold text-blue-800 font-mono mt-1">
                  {currentSheet.recap.hours_last_7_days.toFixed(2)}h
                </div>
              </div>
              <div className="p-2 rounded bg-emerald-50 border border-emerald-200">
                <div className="text-[10px] text-emerald-800 font-semibold">Line B (Avail Tomorrow)</div>
                <div className="text-sm font-bold text-emerald-900 font-mono mt-1">
                  {currentSheet.recap.hours_available_tomorrow.toFixed(2)}h
                </div>
              </div>
              <div className="p-2 rounded bg-slate-50 border border-slate-200">
                <div className="text-[10px] text-slate-500 font-semibold">Line C (Last 8d)</div>
                <div className="text-sm font-bold text-slate-800 font-mono mt-1">
                  {currentSheet.recap.hours_last_8_days.toFixed(2)}h
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Event Table for the Selected Day */}
        <EventTable events={currentSheet.events} />
      </div>
    </div>
  );
};
