'use client';

import Link from 'next/link';
import type { MapMarker } from '@/operations/types/map-marker';

// Status color mapping
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-teal-50 text-teal-700',
  assigned: 'bg-indigo-50 text-indigo-700',
  in_progress: 'bg-amber-50 text-amber-700',
  paused: 'bg-yellow-50 text-yellow-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
  closed: 'bg-slate-50 text-slate-700',
};

// Priority color mapping
const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: 'Normal',
};

interface MapMarkerCardProps {
  marker: MapMarker;
}

export function MapMarkerCard({ marker }: MapMarkerCardProps) {
  const statusColor = STATUS_COLORS[marker.status] || 'bg-gray-100 text-gray-700';
  const statusLabel = marker.status.charAt(0).toUpperCase() + marker.status.slice(1).replace('_', ' ');
  const priorityLabel = PRIORITY_LABELS[marker.priority] || marker.priority;

  // Determine detail URL based on entity type
  const detailUrl = marker.entityType === 'WorkOrder'
    ? `/work-orders/${marker.id}`
    : `/technical-visits/${marker.id}`;

  // Format scheduled date
  const formattedDate = marker.scheduledAt
    ? new Date(marker.scheduledAt).toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <div className="min-w-[220px] text-sm bg-white p-3 rounded-lg shadow-lg">
      {/* Header with entity type and priority */}
      <div className="flex items-center justify-between mb-2">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          marker.entityType === 'WorkOrder'
            ? 'bg-violet-100 text-violet-700'
            : 'bg-cyan-100 text-cyan-700'
        }`}>
          {marker.entityType === 'WorkOrder' ? 'Orden de Trabajo' : 'Visita Técnica'}
        </span>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          marker.priority === 'urgent' ? 'bg-red-100 text-red-700' :
          marker.priority === 'high' ? 'bg-orange-100 text-orange-700' :
          'bg-blue-100 text-blue-700'
        }`}>
          {priorityLabel}
        </span>
      </div>

      {/* Client name */}
      <h3 className="font-semibold text-gray-900 mb-1">{marker.clientName}</h3>

      {/* Location */}
      <p className="text-gray-600 mb-2">{marker.locationName}</p>

      {/* Service type */}
      <p className="text-gray-500 text-xs mb-2">
        <span className="font-medium">Servicio:</span> {marker.serviceType}
      </p>

      {/* Status */}
      <div className="mb-2">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* Technician */}
      <p className="text-gray-500 text-xs mb-1">
        <span className="font-medium">Técnico:</span> {marker.technician || '—'}
      </p>

      {/* Scheduled time */}
      <p className="text-gray-500 text-xs mb-3">
        <span className="font-medium">Programado:</span> {formattedDate}
      </p>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Link
          href={detailUrl}
          className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium bg-brand-600 rounded hover:bg-brand-700 transition-colors"
          style={{ color: '#fff' }}
        >
          Ver detalle
        </Link>
        {marker.latitude && marker.longitude && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${marker.latitude},${marker.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium bg-green-600 rounded hover:bg-green-700 transition-colors"
            style={{ color: '#fff' }}
          >
            Cómo llegar
          </a>
        )}
      </div>
    </div>
  );
}