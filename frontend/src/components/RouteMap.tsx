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

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([39.8283, -98.5795], 4); // Center of US

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
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

    // 1. Draw Route Polyline
    const latLngs: L.LatLngExpression[] = routeGeometry.coordinates.map(
      ([lng, lat]) => [lat, lng] as [number, number]
    );

    if (latLngs.length > 0) {
      const polyline = L.polyline(latLngs, {
        color: '#1d4ed8', // Freight royal blue
        weight: 5,
        opacity: 0.85,
        lineJoin: 'round',
      }).addTo(layerGroup);

      // Fit map to route bounds
      map.fitBounds(polyline.getBounds(), {
        padding: [40, 40],
        maxZoom: 12,
      });
    }

    // 2. Add Stop Markers
    stops.forEach((stop, index) => {
      const { lat, lng } = stop.coordinates;

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
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 13px;
            border: 2px solid white;
            box-shadow: 0 3px 6px rgba(0,0,0,0.3);
          ">
            ${pinSymbol}
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(layerGroup);

      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 13px; min-width: 180px;">
          <strong style="color: ${pinColor}; font-size: 14px;">${label}</strong>
          <div style="margin-top: 4px; color: #475569;">${stop.location}</div>
          <div style="margin-top: 2px; font-size: 11px; color: #94a3b8;">Coord: ${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
        </div>
      `);
    });

    // Invalidate map size on layout changes
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, [routeGeometry, stops]);

  return (
    <div className="relative w-full h-[480px] rounded-lg overflow-hidden border border-slate-300 shadow-sm bg-slate-100">
      <div ref={mapContainerRef} className="w-full h-full" />
      
      {/* Map Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm px-3 py-2 rounded-md shadow border border-slate-200 text-xs font-medium text-slate-700 flex flex-wrap gap-3 items-center">
        <span className="font-semibold text-slate-900">Map Legend:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block"></span> Current
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-sky-600 inline-block"></span> Pickup (1h Loading)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-600 inline-block"></span> Fuel Stop (1,000 mi)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-rose-700 inline-block"></span> Dropoff (1h Unloading)
        </span>
      </div>
    </div>
  );
};
