import React, { useState } from 'react';
import type { DailyLogSheet, DutyStatus } from '../types/trip';

interface DailyLogGraphProps {
  logSheet: DailyLogSheet;
}

const STATUS_ROWS: { key: DutyStatus; label: string; line: number; color: string; y: number }[] = [
  { key: 'OFF_DUTY', label: '1. OFF DUTY', line: 1, color: '#475569', y: 35 },
  { key: 'SLEEPER_BERTH', label: '2. SLEEPER BERTH', line: 2, color: '#6366f1', y: 70 },
  { key: 'DRIVING', label: '3. DRIVING', line: 3, color: '#16a34a', y: 105 },
  { key: 'ON_DUTY_NOT_DRIVING', label: '4. ON DUTY (NOT DRIVING)', line: 4, color: '#d97706', y: 140 },
];

export const DailyLogGraph: React.FC<DailyLogGraphProps> = ({ logSheet }) => {
  const [viewMode, setViewMode] = useState<'vector' | 'paper'>('vector');
  const [hoveredEvent, setHoveredEvent] = useState<{
    activity: string;
    status: string;
    timeRange: string;
    duration: string;
    location: string;
  } | null>(null);

  // Vector grid dimensions (in SVG coordinate units)
  const SVG_WIDTH = 960;
  const SVG_HEIGHT = 175;
  const X_START = 160;  // Left margin for row labels
  const X_END = 900;    // Right margin before total hours
  const GRID_WIDTH = X_END - X_START;

  // Convert ISO time string to hours from midnight [0.0, 24.0]
  const timeToHours = (isoStr: string): number => {
    const d = new Date(isoStr);
    const hrs = d.getUTCHours() + d.getUTCMinutes() / 60.0 + d.getUTCSeconds() / 3600.0;
    return hrs;
  };

  const formatTime = (isoStr: string, isEndTime: boolean = false): string => {
    const d = new Date(isoStr);
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    if (isEndTime && h === 0 && m === 0) {
      return '24:00';
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Build continuous SVG path
  let pathD = '';
  const segmentRects: React.ReactNode[] = [];

  const rowYMap: Record<DutyStatus, number> = {
    OFF_DUTY: 35,
    SLEEPER_BERTH: 70,
    DRIVING: 105,
    ON_DUTY_NOT_DRIVING: 140,
  };

  logSheet.events.forEach((ev, idx) => {
    let h1 = timeToHours(ev.start_time);
    let h2 = timeToHours(ev.end_time);

    // If event ends at midnight of next day, clamp to 24.0
    if (h2 === 0 && new Date(ev.end_time).getTime() > new Date(ev.start_time).getTime()) {
      h2 = 24.0;
    }
    if (h2 < h1) {
      h2 = 24.0;
    }

    const x1 = X_START + (h1 / 24.0) * GRID_WIDTH;
    const x2 = X_START + (h2 / 24.0) * GRID_WIDTH;
    const y = rowYMap[ev.status];

    // Tracing path
    if (idx === 0) {
      pathD += `M ${x1.toFixed(2)} ${y}`;
    } else {
      const prevEv = logSheet.events[idx - 1];
      const prevY = rowYMap[prevEv.status];
      if (prevY !== y) {
        pathD += ` L ${x1.toFixed(2)} ${y}`; // Vertical transition
      }
    }
    pathD += ` L ${x2.toFixed(2)} ${y}`; // Horizontal segment

    // Transparent interactive hover rect
    segmentRects.push(
      <rect
        key={ev.id || idx}
        x={Math.min(x1, x2)}
        y={y - 12}
        width={Math.max(2, Math.abs(x2 - x1))}
        height={24}
        fill="transparent"
        className="cursor-pointer hover:fill-blue-500/20"
        onMouseEnter={() => {
          setHoveredEvent({
            activity: ev.activity,
            status: ev.status.replace(/_/g, ' '),
            timeRange: `${formatTime(ev.start_time)} - ${formatTime(ev.end_time, true)}`,
            duration: `${ev.duration_hours.toFixed(2)} hrs`,
            location: ev.location,
          });
        }}
        onMouseLeave={() => setHoveredEvent(null)}
      />
    );
  });

  // Paper overlay coordinate calibration for blank-paper-log.png
  const PAPER_X_START = 125.0;
  const PAPER_X_END = 885.0;
  const PAPER_GRID_WIDTH = PAPER_X_END - PAPER_X_START;
  const PAPER_Y_ROWS: Record<DutyStatus, number> = {
    OFF_DUTY: 368.0,
    SLEEPER_BERTH: 405.0,
    DRIVING: 442.0,
    ON_DUTY_NOT_DRIVING: 478.0,
  };

  let paperPathD = '';
  logSheet.events.forEach((ev, idx) => {
    let h1 = timeToHours(ev.start_time);
    let h2 = timeToHours(ev.end_time);
    if (h2 === 0 && new Date(ev.end_time).getTime() > new Date(ev.start_time).getTime()) h2 = 24.0;
    if (h2 < h1) h2 = 24.0;

    const x1 = PAPER_X_START + (h1 / 24.0) * PAPER_GRID_WIDTH;
    const x2 = PAPER_X_START + (h2 / 24.0) * PAPER_GRID_WIDTH;
    const y = PAPER_Y_ROWS[ev.status];

    if (idx === 0) {
      paperPathD += `M ${x1.toFixed(2)} ${y}`;
    } else {
      const prevEv = logSheet.events[idx - 1];
      const prevY = PAPER_Y_ROWS[prevEv.status];
      if (prevY !== y) {
        paperPathD += ` L ${x1.toFixed(2)} ${y}`;
      }
    }
    paperPathD += ` L ${x2.toFixed(2)} ${y}`;
  });

  return (
    <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4">
      {/* Header with View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            FMCSA 24-Hour Duty Status Graph
            <span className="text-xs font-normal px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono">
              Day {logSheet.day_number} &bull; {logSheet.date_string}
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            49 CFR § 395 Record of Duty Status (RODS) &bull; Standard Home Terminal UTC Time
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="inline-flex p-0.5 bg-slate-100 rounded-md border border-slate-300 text-xs font-medium">
          <button
            type="button"
            onClick={() => setViewMode('vector')}
            className={`px-3 py-1 rounded transition-colors ${
              viewMode === 'vector'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Vector Grid View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('paper')}
            className={`px-3 py-1 rounded transition-colors ${
              viewMode === 'paper'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Paper Sheet Overlay
          </button>
        </div>
      </div>

      {/* Vector Graph View */}
      {viewMode === 'vector' && (
        <div className="mt-3 overflow-x-auto">
          <div className="min-w-[800px]">
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="w-full h-auto select-none font-sans"
            >
              {/* Row Background Bands */}
              {STATUS_ROWS.map((row, i) => (
                <g key={row.key}>
                  <rect
                    x={X_START}
                    y={row.y - 17.5}
                    width={GRID_WIDTH}
                    height={35}
                    fill={i % 2 === 0 ? '#f8fafc' : '#ffffff'}
                  />
                  {/* Row Label */}
                  <text
                    x={X_START - 10}
                    y={row.y + 4}
                    textAnchor="end"
                    className="text-[10px] font-bold fill-slate-700 font-mono"
                  >
                    {row.label}
                  </text>
                  {/* Row Baseline */}
                  <line
                    x1={X_START}
                    y1={row.y}
                    x2={X_END}
                    y2={row.y}
                    stroke="#cbd5e1"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                  {/* Row Total Hours (Right Margin) */}
                  <text
                    x={X_END + 25}
                    y={row.y + 4}
                    textAnchor="middle"
                    className="text-xs font-bold font-mono fill-slate-900"
                  >
                    {row.key === 'OFF_DUTY' && logSheet.totals.off_duty_hours.toFixed(1)}
                    {row.key === 'SLEEPER_BERTH' && logSheet.totals.sleeper_berth_hours.toFixed(1)}
                    {row.key === 'DRIVING' && logSheet.totals.driving_hours.toFixed(1)}
                    {row.key === 'ON_DUTY_NOT_DRIVING' && logSheet.totals.on_duty_not_driving_hours.toFixed(1)}
                  </text>
                </g>
              ))}

              {/* Top and Bottom Horizontal Borders */}
              <line x1={X_START} y1={17.5} x2={X_END} y2={17.5} stroke="#64748b" strokeWidth="1.5" />
              <line x1={X_START} y1={157.5} x2={X_END} y2={157.5} stroke="#64748b" strokeWidth="1.5" />

              {/* 24-Hour Vertical Grid Lines & Ticks */}
              {Array.from({ length: 25 }).map((_, hour) => {
                const x = X_START + (hour / 24.0) * GRID_WIDTH;
                const isMajor = hour === 0 || hour === 12 || hour === 24;
                const hourLabel =
                  hour === 0 ? 'Mid' : hour === 12 ? 'Noon' : hour === 24 ? 'Mid' : `${hour > 12 ? hour - 12 : hour}`;

                return (
                  <g key={hour}>
                    {/* Hour Vertical Grid Line */}
                    <line
                      x1={x}
                      y1={17.5}
                      x2={x}
                      y2={157.5}
                      stroke={isMajor ? '#475569' : '#cbd5e1'}
                      strokeWidth={isMajor ? 1.5 : 0.75}
                    />

                    {/* Top Hour Number Label */}
                    <text
                      x={x}
                      y={12}
                      textAnchor="middle"
                      className="text-[9px] font-bold font-mono fill-slate-600"
                    >
                      {hourLabel}
                    </text>

                    {/* 15-Minute Sub-Hour Tick Marks */}
                    {hour < 24 &&
                      [15, 30, 45].map((m) => {
                        const subX = x + ((m / 60.0) / 24.0) * GRID_WIDTH;
                        return (
                          <g key={m}>
                            {STATUS_ROWS.map((r) => (
                              <line
                                key={r.key}
                                x1={subX}
                                y1={r.y - (m === 30 ? 5 : 3)}
                                x2={subX}
                                y2={r.y + (m === 30 ? 5 : 3)}
                                stroke="#94a3b8"
                                strokeWidth="0.5"
                              />
                            ))}
                          </g>
                        );
                      })}
                  </g>
                );
              })}

              {/* Total Column Header */}
              <text x={X_END + 25} y={12} textAnchor="middle" className="text-[10px] font-bold font-mono fill-slate-800">
                Total
              </text>
              <line x1={X_END} y1={17.5} x2={X_END} y2={157.5} stroke="#64748b" strokeWidth="1.5" />
              <line x1={X_END + 50} y1={17.5} x2={X_END + 50} y2={157.5} stroke="#64748b" strokeWidth="1.5" />

              {/* Continuous Active Duty Line (Minute-Level Accuracy) */}
              <path
                d={pathD}
                fill="none"
                stroke="#1d4ed8"
                strokeWidth="3.5"
                strokeLinecap="square"
                strokeLinejoin="miter"
              />

              {/* Interactive Rectangles for Tooltips */}
              {segmentRects}
            </svg>
          </div>
        </div>
      )}

      {/* Paper Sheet Overlay View */}
      {viewMode === 'paper' && (
        <div className="mt-3 relative w-full max-w-4xl mx-auto rounded overflow-hidden border border-slate-400 bg-white">
          <img
            src="/blank-paper-log.png"
            alt="Blank FMCSA Driver Daily Log"
            className="w-full h-auto block select-none pointer-events-none"
          />

          {/* SVG Overlay matching calibrated pixels */}
          <svg
            viewBox="0 0 1000 1000"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            {/* Continuous Graph Line */}
            <path
              d={paperPathD}
              fill="none"
              stroke="#0284c7"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Header Text Overlay */}
            <text x="430" y="45" className="text-xs font-bold font-mono fill-slate-900">{logSheet.date_string}</text>
            <text x="130" y="85" className="text-xs font-semibold fill-slate-800">{logSheet.from_location.slice(0, 32)}</text>
            <text x="510" y="85" className="text-xs font-semibold fill-slate-800">{logSheet.to_location.slice(0, 32)}</text>
            <text x="180" y="155" className="text-xs font-bold font-mono fill-blue-900">{logSheet.miles_driving_today.toFixed(1)}</text>
            <text x="350" y="155" className="text-xs font-bold font-mono fill-blue-900">{logSheet.total_mileage_today.toFixed(1)}</text>
            <text x="550" y="155" className="text-xs font-semibold fill-slate-800">{logSheet.carrier_name}</text>
            <text x="180" y="215" className="text-xs font-mono fill-slate-800">{logSheet.truck_number} / {logSheet.trailer_number}</text>

            {/* Subtotal Hours at Right Margin */}
            <text x="930" y="373" className="text-sm font-bold font-mono fill-slate-900">{logSheet.totals.off_duty_hours.toFixed(1)}</text>
            <text x="930" y="410" className="text-sm font-bold font-mono fill-slate-900">{logSheet.totals.sleeper_berth_hours.toFixed(1)}</text>
            <text x="930" y="447" className="text-sm font-bold font-mono fill-slate-900">{logSheet.totals.driving_hours.toFixed(1)}</text>
            <text x="930" y="483" className="text-sm font-bold font-mono fill-slate-900">{logSheet.totals.on_duty_not_driving_hours.toFixed(1)}</text>

            {/* Recap Table Data */}
            <text x="160" y="930" className="text-xs font-bold font-mono fill-slate-900">{logSheet.recap.on_duty_today.toFixed(1)}</text>
            <text x="320" y="930" className="text-xs font-bold font-mono fill-slate-900">{logSheet.recap.hours_last_7_days.toFixed(1)}</text>
            <text x="400" y="930" className="text-xs font-bold font-mono fill-slate-900">{logSheet.recap.hours_available_tomorrow.toFixed(1)}</text>
          </svg>
        </div>
      )}

      {/* Hover Info Tooltip Bar */}
      <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded text-xs flex flex-wrap items-center justify-between min-h-[36px]">
        {hoveredEvent ? (
          <div className="flex flex-wrap items-center gap-4 text-slate-800">
            <span className="font-semibold text-blue-700">{hoveredEvent.status}</span>
            <span><strong>Time:</strong> {hoveredEvent.timeRange} ({hoveredEvent.duration})</span>
            <span><strong>Activity:</strong> {hoveredEvent.activity}</span>
            <span><strong>Location:</strong> {hoveredEvent.location}</span>
          </div>
        ) : (
          <span className="text-slate-400 italic">
            Hover over any section of the duty graph to view minute-level event details and location.
          </span>
        )}

        <div className="font-mono font-bold text-slate-700 ml-auto">
          Daily Total: <span className="text-emerald-700">{logSheet.totals.total_hours.toFixed(2)} hrs</span> (24.0h DOT Invariant)
        </div>
      </div>
    </div>
  );
};
