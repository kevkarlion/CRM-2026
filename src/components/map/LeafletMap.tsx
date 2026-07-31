'use client';

import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, useMap, Marker } from 'react-leaflet';
import type { MapMarker } from '@/operations/types/map-marker';
import { MapMarkerComponent } from './MapMarker';
import 'leaflet/dist/leaflet.css';

// User location marker component
function UserLocationMarker({ lat, lng }: { lat: number; lng: number }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Marker
      position={[lat, lng]}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      icon={(window as any).L?.divIcon({
        className: 'user-location-marker',
        html: `<div style="
          background-color: #3b82f6;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })}
    />
  );
}

// Default center: Santiago, Chile
const DEFAULT_CENTER: [number, number] = [-33.4489, -70.6693];
const DEFAULT_ZOOM = 12;

// Fix Leaflet default icon issue in Next.js
function fixLeafletIcons() {
  // This only runs on client, so window is safe here
  if (typeof window === 'undefined') return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const L = (window as any).L;
  if (L && L.Icon) {
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }
}

interface LeafletMapProps {
  markers: MapMarker[];
  onMarkerClick?: (marker: MapMarker) => void;
  userLocation?: { lat: number; lng: number } | null;
  onUserLocationRequest?: () => void;
}

function MapController({ markers, userLocation }: { markers: MapMarker[]; userLocation?: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (markers.length === 0 && !userLocation) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L;
    if (!L) return;

    const allPoints: [number, number][] = [];

    // Add marker points
    markers.forEach((marker) => {
      allPoints.push([marker.latitude, marker.longitude]);
    });

    // Add user location
    if (userLocation) {
      allPoints.push([userLocation.lat, userLocation.lng]);
    }

    // Fit bounds to show all markers and user location
    const bounds = L.latLngBounds(allPoints);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [markers, map, userLocation]);

  return null;
}

export function LeafletMap({ markers, onMarkerClick, userLocation }: LeafletMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fixLeafletIcons();
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
        <span className="text-gray-400">Cargando mapa...</span>
      </div>
    );
  }

  // Calculate center from first marker or use default
  const center: [number, number] = markers.length > 0
    ? [markers[0].latitude, markers[0].longitude]
    : DEFAULT_CENTER;

return (
    <MapContainer
      center={center}
      zoom={DEFAULT_ZOOM}
      className="w-full h-full rounded-lg"
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {/* User location marker */}
      {userLocation && (
        <UserLocationMarker lat={userLocation.lat} lng={userLocation.lng} />
      )}
      <MapController markers={markers} userLocation={userLocation} />
      {markers.map((marker) => (
        <MapMarkerComponent
          key={`${marker.entityType}-${marker.id}`}
          marker={marker}
          onClick={onMarkerClick}
        />
      ))}
    </MapContainer>
  );
}