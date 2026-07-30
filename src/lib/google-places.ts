/**
 * Google Places Service
 * Provides integration with Google Maps Places API for address autocomplete,
 * geocoding, and place details retrieval.
 */

declare global {
  interface Window {
    google: typeof google;
    initGooglePlaces: () => void;
  }
}

export interface PlaceAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface PlaceGeometry {
  location: {
    lat(): number;
    lng(): number;
  };
}

export interface GooglePlaceResult {
  place_id: string;
  address_components: PlaceAddressComponent[];
  geometry: PlaceGeometry;
  formatted_address: string;
  name?: string;
}

export interface ParsedPlaceDetails {
  name?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
}

const GOOGLE_PLACES_SCRIPT_ID = 'google-places-script';
let isLoading = false;
let loadPromise: Promise<void> | null = null;

/**
 * Loads the Google Places API script dynamically
 * @returns Promise that resolves when script is loaded, or rejects if no API key
 */
export async function loadGooglePlacesScript(): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Graceful degradation - no API key means skip loading
  if (!apiKey) {
    console.warn('[GooglePlaces] No API key configured. Location features will be disabled.');
    return;
  }

  // If already loaded, return
  if (window.google?.maps?.places) {
    return;
  }

  // If currently loading, wait for existing promise
  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;

  return new Promise((resolve, reject) => {
    // Check if script already exists
    const existingScript = document.getElementById(GOOGLE_PLACES_SCRIPT_ID);
    if (existingScript) {
      isLoading = false;
      resolve();
      return;
    }

    // Set up global callback
    window.initGooglePlaces = () => {
      isLoading = false;
      resolve();
    };

    // Create and append script
    const script = document.createElement('script');
    script.id = GOOGLE_PLACES_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGooglePlaces`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      isLoading = false;
      reject(new Error('Failed to load Google Places script'));
    };

    document.head.appendChild(script);
  });
}

/**
 * Extracts address component by type from Google Places result
 */
function getAddressComponent(
  components: PlaceAddressComponent[],
  type: string
): string | undefined {
  const component = components.find((c) => c.types.includes(type));
  return component?.long_name;
}

/**
 * Parses Google Places result into structured location data
 */
export function parsePlaceDetails(place: GooglePlaceResult): ParsedPlaceDetails {
  const { address_components, geometry, formatted_address, name, place_id } = place;

  return {
    name: name || getAddressComponent(address_components, 'premise'),
    address: formatted_address,
    city:
      getAddressComponent(address_components, 'locality') ||
      getAddressComponent(address_components, 'sublocality') ||
      getAddressComponent(address_components, 'administrative_area_level_2'),
    province: getAddressComponent(address_components, 'administrative_area_level_1'),
    country: getAddressComponent(address_components, 'country'),
    postalCode: getAddressComponent(address_components, 'postal_code'),
    latitude: geometry.location.lat(),
    longitude: geometry.location.lng(),
    placeId: place_id,
  };
}

/**
 * Initializes autocomplete on an input element
 * @param inputElement - The input element to attach autocomplete to
 * @param options - Optional configuration for autocomplete
 * @returns Autocomplete instance or null if Google API not available
 */
export function initAutocomplete(
  inputElement: HTMLInputElement,
  options?: google.maps.places.AutocompleteOptions
): google.maps.places.Autocomplete | null {
  if (!window.google?.maps?.places) {
    console.warn('[GooglePlaces] Google Places API not loaded');
    return null;
  }

  const defaultOptions: google.maps.places.AutocompleteOptions = {
    types: ['address'],
    fields: ['address_components', 'geometry', 'formatted_address', 'name', 'place_id'],
  };

  return new window.google.maps.places.Autocomplete(inputElement, {
    ...defaultOptions,
    ...options,
  });
}

/**
 * Gets full place details from a Place ID
 * @param placeId - Google Place ID
 * @returns Parsed place details or null if failed
 */
export async function getPlaceDetails(placeId: string): Promise<ParsedPlaceDetails | null> {
  if (!window.google?.maps?.places) {
    console.warn('[GooglePlaces] Google Places API not loaded');
    return null;
  }

  const service = new window.google.maps.places.PlacesService(
    document.createElement('div')
  );

  return new Promise((resolve) => {
    service.getDetails(
      {
        placeId,
        fields: ['address_components', 'geometry', 'formatted_address', 'name', 'place_id'],
      },
      (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
          resolve(parsePlaceDetails(place as GooglePlaceResult));
        } else {
          console.warn('[GooglePlaces] Failed to get place details:', status);
          resolve(null);
        }
      }
    );
  });
}

/**
 * Geocodes an address string to coordinates (fallback when Places API not available)
 * @param address - Address string to geocode
 * @returns Geocoding result with coordinates or null if failed
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.warn('[GooglePlaces] No API key configured for geocoding');
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`
    );

    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
      };
    }

    console.warn('[GooglePlaces] Geocoding failed:', data.status);
    return null;
  } catch (error) {
    console.error('[GooglePlaces] Geocoding error:', error);
    return null;
  }
}

/**
 * Checks if Google Places API is available and configured
 */
export function isGooglePlacesAvailable(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY &&
    window.google?.maps?.places
  );
}
