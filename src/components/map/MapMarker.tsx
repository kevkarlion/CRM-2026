'use client';

import { useEffect, useState, useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import type { MapMarker as MapMarkerType } from '@/operations/types/map-marker';
import { MapMarkerCard } from './MapMarkerCard';

interface MapMarkerComponentProps {
  marker: MapMarkerType;
  onClick?: (marker: MapMarkerType) => void;
  currentTechnicianId?: string;
  isTechnician?: boolean;
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

// Technician colors palette - distinct colors for each technician
const TECHNICIAN_COLORS = [
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#059669', // emerald
  '#dc2626', // red
  '#d97706', // amber
  '#7c3aed', // violet
  '#db2777', // pink
  '#4f46e5', // indigo
  '#2563eb', // blue
  '#16a34a', // green
];

// Get technician color based on ID
function getTechnicianColor(technicianId?: string): string | null {
  if (!technicianId) return null;
  // Generate a consistent color based on the ID string
  let hash = 0;
  for (let i = 0; i < technicianId.length; i++) {
    hash = technicianId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % TECHNICIAN_COLORS.length;
  return TECHNICIAN_COLORS[index];
}

// Function to create colored icon HTML
function getIconHtml(
  priority: string, 
  entityType: string, 
  technicianId?: string,
  isOwn: boolean = false
): string {
  const priorityColor = PRIORITY_COLORS[priority] || PRIORITY_COLORS.normal;
  const entityColor = ENTITY_COLORS[entityType] || ENTITY_COLORS.WorkOrder;
  const techColor = getTechnicianColor(technicianId);
  const label = entityType === 'WorkOrder' ? 'OT' : 'VT';

  // Use technician color if available, otherwise use entity color
  const bgColor = techColor || entityColor;
  
  // Add border for own markers
  const borderStyle = isOwn ? 'border: 3px solid #fbbf24;' : ''; // yellow border for own

  return `
    <div style="
      width: 32px;
      height: 32px;
      background: ${bgColor};
      border: 3px solid ${priorityColor};
      ${borderStyle}
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

export function MapMarkerComponent({ marker, onClick, currentTechnicianId, isTechnician }: MapMarkerComponentProps) {
  const [leaflet, setLeaflet] = useState<typeof import('leaflet') | null>(null);
  
  // Check if this marker belongs to current technician
  const isOwn = isTechnician && currentTechnicianId && marker.technicianId === currentTechnicianId;
  
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
      html: getIconHtml(marker.priority, marker.entityType, marker.technicianId, isOwn),
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  }, [leaflet, marker.priority, marker.entityType, marker.technicianId, isOwn]);

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