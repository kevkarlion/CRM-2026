'use client';

import { useEffect, useRef, useState } from 'react';
import {
  loadGooglePlacesScript,
  initAutocomplete,
  parsePlaceDetails,
  isGooglePlacesAvailable,
  ParsedPlaceDetails,
} from '@/lib/google-places';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, details?: ParsedPlaceDetails) => void;
  placeholder?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Ingrese dirección...',
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<google.maps.places.PlaceResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    async function init() {
      await loadGooglePlacesScript();
      setIsApiLoaded(isGooglePlacesAvailable());
    }
    init();
  }, []);

  useEffect(() => {
    if (isApiLoaded && inputRef.current) {
      autocompleteRef.current = initAutocomplete(inputRef.current);

      if (autocompleteRef.current) {
        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current?.getPlace();
          if (place) {
            const details = parsePlaceDetails(place as never);
            onChange(details.address || '', details);
            setIsOpen(false);
          }
        });
      }
    }
  }, [isApiLoaded, onChange]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    onChange(newValue, undefined);
    setSuggestions([]);
    setIsOpen(false);
  }

  function handleSelect(place: google.maps.places.PlaceResult) {
    const details = parsePlaceDetails(place as never);
    onChange(details.address || '', details);
    setIsOpen(false);
  }

  // Fallback: plain input when no API key
  if (!isApiLoaded) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
      />
    );
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none bg-white"
      />
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {suggestions.map((place, index) => (
            <li
              key={index}
              onClick={() => handleSelect(place)}
              className="px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-0"
            >
              {place.formatted_address}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
