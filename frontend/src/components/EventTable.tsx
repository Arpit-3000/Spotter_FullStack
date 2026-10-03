import React from 'react';
import type { HOSEvent, DutyStatus } from '../types/trip';

interface EventTableProps {
  events: HOSEvent[];
}

const statusBadgeStyles: Record<DutyStatus, { bg: string; text: string; label: string }> = {
  OFF_DUTY: { bg: 'bg-slate-100', text: 'text-slate-700 border-slate-300', label: '1. Off Duty' },
  SLEEPER_BERTH: { bg: 'bg-indigo-50', text: 'text-indigo-700 border-indigo-200', label: '2. Sleeper Berth' },
  DRIVING: { bg: 'bg-emerald-50', text: 'text-emerald-700 border-emerald-200', label: '3. Driving' },
  ON_DUTY_NOT_DRIVING: { bg: 'bg-amber-50', text: 'text-amber-800 border-amber-200', label: '4. On Duty (Not Driving)' },
};

export const EventTable: React.FC<EventTableProps> = ({ events }) => {
  const formatTime = (isoStr: string, isEndTime: boolean = false): string => {
    const d = new Date(isoStr);
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    if (isEndTime && h === 0 && m === 0) {
      return '24:00';
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
        <h4 className="text-sm font-bold text-slate-800">
          Chronological Duty Status Changes &amp; Remarks
        </h4>
        <span className="text-xs text-slate-500 font-medium">
          {events.length} event segments
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <th className="py-2.5 px-3">Time Range</th>
              <th className="py-2.5 px-3">Duration</th>
              <th className="py-2.5 px-3">Duty Status</th>
              <th className="py-2.5 px-3">Activity</th>
              <th className="py-2.5 px-3">Location</th>
              <th className="py-2.5 px-3">Remarks / Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {events.map((ev, index) => {
              const badge = statusBadgeStyles[ev.status];
              return (
                <tr key={ev.id || index} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-medium text-slate-800 whitespace-nowrap">
                    {formatTime(ev.start_time)} &rarr; {formatTime(ev.end_time, true)}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                    {ev.duration_hours.toFixed(2)}h
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-0.5 rounded border text-[11px] font-medium ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-800">
                    {ev.activity}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate" title={ev.location}>
                    {ev.location}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 max-w-[250px] truncate" title={ev.remarks}>
                    {ev.remarks}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
