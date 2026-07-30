'use client';

import { useState } from 'react';

interface LocationActionsProps {
  address: string;
  latitude?: number;
  longitude?: number;
}

export function LocationActions({ address, latitude, longitude }: LocationActionsProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const hasCoordinates = latitude && longitude;

  function openInGoogleMaps() {
    let url: string;
    if (hasCoordinates) {
      // Use coordinates for exact location
      url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    } else if (address) {
      // Fallback to address search
      const query = encodeURIComponent(address);
      url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    }
    if (url) {
      window.open(url, '_blank');
    }
  }

  function startNavigation() {
    if (!hasCoordinates) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`, '_blank');
  }

  async function copyToClipboard(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  const coordsString = hasCoordinates ? `${latitude},${longitude}` : null;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={openInGoogleMaps}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span>📍</span>
        <span>Abrir en Google Maps</span>
      </button>

      <button
        type="button"
        onClick={startNavigation}
        disabled={!hasCoordinates}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
          hasCoordinates
            ? 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
        }`}
      >
        <span>🧭</span>
        <span>Iniciar navegación</span>
      </button>

      <button
        type="button"
        onClick={() => copyToClipboard(address, 'address')}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span>📋</span>
        <span>{copiedField === 'address' ? '¡Copiado!' : 'Copiar dirección'}</span>
      </button>

      {coordsString && (
        <button
          type="button"
          onClick={() => copyToClipboard(coordsString, 'coords')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>📌</span>
          <span>{copiedField === 'coords' ? '¡Copiado!' : 'Copiar coordenadas'}</span>
        </button>
      )}
    </div>
  );
}
