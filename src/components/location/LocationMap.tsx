'use client';

interface LocationMapProps {
  latitude: number;
  longitude: number;
  address?: string;
}

export function LocationMap({ latitude, longitude, address }: LocationMapProps) {
  const hasCoordinates = latitude && longitude;

  if (!hasCoordinates) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-500">Ver en mapa</p>
        {address && <p className="text-xs text-gray-400 mt-1">{address}</p>}
      </div>
    );
  }

  // Google Maps Embed API - no API key required for basic embed
  const embedUrl = `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}&q=${latitude},${longitude}&zoom=15`;

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <iframe
        src={embedUrl}
        width="100%"
        height="200"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title={`Mapa de ${address || `${latitude},${longitude}`}`}
      />
      {address && (
        <div className="p-3 bg-gray-50 border-t border-gray-200">
          <p className="text-sm text-gray-600 truncate">{address}</p>
        </div>
      )}
    </div>
  );
}
