'use client';

import { useEffect, useState, useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import type { MapMarker as MapMarkerType } from '@/operations/types/map-marker';
import { MapMarkerCard } from './MapMarkerCard';

interface MapMarkerComponentProps {
  marker: MapMarkerType;
  onClick?: (marker: MapMarkerType) => void;
}

// Priority color mapping
const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#dc2626',   // red-600
  high: '#ea580c',     // orange-600
  normal: '#2563eb',   // blue-600
  low: '#6b7280',      // gray-500
};

// Entity type color mapping
const ENTITY_COLORS: Record<string, string> = {
  WorkOrder: '#7c3aed',     // violet-600
  TechnicalVisit: '#0891b2', // cyan-600
};

// Function to create colored icon HTML
function getIconHtml(priority: string, entityType: string): string {
  const priorityColor = PRIORITY_COLORS[priority] || PRIORITY_COLORS.normal;
  const entityColor = ENTITY_COLORS[entityType] || ENTITY_COLORS.WorkOrder;
  const label = entityType === 'WorkOrder' ? 'OT' : 'VT';

  return `
    <div style="
      width: 32px;
      height: 32px;
      background: ${entityColor};
      border: 3px solid ${priorityColor};
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <span style="
        font-size: 12px;
        font-weight: bold;
        color: white;
        transform: rotate(45deg);
      ">${label}</span>
    </div>
  `;
}

export function MapMarkerComponent({ marker, onClick }: MapMarkerComponentProps) {
  const [leaflet, setLeaflet] = useState<typeof import('leaflet') | null>(null);
  const handleClick = () => {
    if (onClick) {
      onClick(marker);
    }
  };

  const position: [number, number] = [marker.latitude, marker.longitude];

  // Dynamically load Leaflet on client only
  useEffect(() => {
    import('leaflet').then((L) => {
      setLeaflet(L);
    });
  }, []);

  // Create icon once Leaflet is loaded
  const icon = useMemo(() => {
    if (!leaflet) return null;
    
    return leaflet.divIcon({
      className: 'custom-marker',
      html: getIconHtml(marker.priority, marker.entityType),
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  }, [leaflet, marker.priority, marker.entityType]);

  // Don't render marker until Leaflet is loaded
  if (!leaflet || !icon) {
    return null;
  }

  return (
    <Marker
      position={position}
      icon={icon}
      eventHandlers={{
        click: handleClick,
      }}
    >
      <Popup>
        <MapMarkerCard marker={marker} />
      </Popup>
    </Marker>
  );
}