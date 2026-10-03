import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RouteGeometry, Stop } from '../types/trip';

interface RouteMapProps {
  routeGeometry: RouteGeometry;
  stops: Stop[];
}

export const RouteMap: React.FC<RouteMapProps> = ({ routeGeometry, stops }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // 1. Initialize Leaflet Map if not already initialized
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([39.8283, -98.5795], 4); // Geographic center of US

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;

    if (layerGroup) {
      layerGroup.clearLayers();
    }

    if (!map || !layerGroup) return;

    // 2. Draw Route Polyline
    const validCoords = (routeGeometry?.coordinates || []).filter(
      (c) => Array.isArray(c) && c.length >= 2 && !isNaN(c[0]) && !isNaN(c[1])
    );
    const latLngs: L.LatLngExpression[] = validCoords.map(
      ([lng, lat]) => [lat, lng] as [number, number]
    );

    if (latLngs.length > 0) {
      const polyline = L.polyline(latLngs, {
        color: '#1d4ed8', // Freight royal blue
        weight: 5,
        opacity: 0.85,
        lineJoin: 'round',
      }).addTo(layerGroup);

      // Fit map to route bounds safely
      try {
        const bounds = polyline.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, {
            padding: [45, 45],
            maxZoom: 12,
          });
        }
      } catch (err) {
        console.warn('Could not fitBounds on polyline:', err);
      }
    }

    // 3. Add Stop Markers
    stops.forEach((stop, index) => {
      const { lat, lng } = stop.coordinates;
      if (isNaN(lat) || isNaN(lng)) return;

      let pinColor = '#3b82f6';
      let pinSymbol = `${index + 1}`;
      let label = stop.name;

      if (stop.type === 'origin') {
        pinColor = '#15803d'; // Green
        pinSymbol = 'A';
      } else if (stop.type === 'pickup') {
        pinColor = '#0284c7'; // Sky/Blue
        pinSymbol = 'P';
      } else if (stop.type === 'fuel') {
        pinColor = '#d97706'; // Amber
        pinSymbol = '⛽';
      } else if (stop.type === 'dropoff') {
        pinColor = '#b91c1c'; // Red
        pinSymbol = 'D';
      }

      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="
            background-color: ${pinColor};
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 13px;
            border: 2px solid white;
            box-shadow: 0 3px 6px rgba(0,0,0,0.35);
          ">
            ${pinSymbol}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(layerGroup);

      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 13px; min-width: 180px;">
          <strong style="color: ${pinColor}; font-size: 14px;">${label}</strong>
          <div style="margin-top: 4px; color: #475569;">${stop.location}</div>
          <div style="margin-top: 2px; font-size: 11px; color: #94a3b8;">GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
        </div>
      `);
    });

    // 4. Force map invalidation on mount and layout changes so tiles render immediately
    const timers = [
      setTimeout(() => map.invalidateSize(), 50),
      setTimeout(() => map.invalidateSize(), 200),
      setTimeout(() => map.invalidateSize(), 500),
      setTimeout(() => map.invalidateSize(), 1000),
    ];

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      timers.forEach((t) => clearTimeout(t));
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, [routeGeometry, stops]);

  return (
    <div
      className="relative w-full rounded-lg overflow-hidden border border-slate-300 shadow-sm bg-slate-100"
      style={{ width: '100%', height: '520px', minHeight: '520px', position: 'relative' }}
    >
      {/* Actual Leaflet Map Canvas */}
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ width: '100%', height: '100%', minHeight: '520px' }}
      />

      {/* Map Legend Overlay */}
      <div
        className="absolute bottom-3 left-3 bg-white/95 px-3 py-2 rounded-md shadow border border-slate-200 text-xs font-medium text-slate-700 flex flex-wrap gap-3 items-center"
        style={{ zIndex: 1000 }}
      >
        <span className="font-semibold text-slate-900">Map Legend:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" /> Current
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-sky-600 inline-block" /> Pickup (1h Loading)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-600 inline-block" /> Fuel Stop (1,000 mi)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-rose-700 inline-block" /> Dropoff (1h Unloading)
        </span>
      </div>
    </div>
  );
};
