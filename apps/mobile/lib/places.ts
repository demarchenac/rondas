import * as Location from 'expo-location';
import * as Sentry from '@sentry/react-native';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types?: string[];
}

interface GooglePlaceResult {
  name: string;
  formatted_address?: string;
  address_components?: GoogleAddressComponent[];
  geometry?: {
    location: { lat: number; lng: number };
  };
}

/** Remove comma-separated segments already contained in a prior segment. */
function deduplicateAddress(address: string): string {
  const parts = address.split(',').map((segment) => segment.trim()).filter(Boolean);
  const kept: string[] = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (!kept.some((prev) => prev.toLowerCase().includes(lower))) {
      kept.push(part);
    }
  }
  return kept.join(', ');
}

interface PlaceResult {
  name: string;
  address?: string;
  city?: string;
  country?: string;
}

/**
 * Resolve a place name and address from GPS coordinates.
 * Strategy:
 * 1. Try native reverse geocode (Apple/Google Maps — free)
 * 2. If no business name found, fallback to Google Places Text Search (optional)
 */
export async function resolvePlace(
  latitude: number,
  longitude: number
): Promise<PlaceResult | null> {
  const nativeResult = await tryNativeGeocode(latitude, longitude);
  if (nativeResult) return nativeResult;

  // Native failed entirely — try Google directly
  if (GOOGLE_PLACES_API_KEY) {
    const googleResult = await searchGooglePlaces('', undefined, latitude, longitude);
    if (googleResult) return googleResult;
  }

  return null;
}

async function tryNativeGeocode(
  latitude: number,
  longitude: number
): Promise<PlaceResult | null> {
  let geo: Location.LocationGeocodedAddress;
  try {
    const [result] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!result) return null;
    geo = result;
  } catch (err) {
    console.warn('[Places] reverse geocode failed:', err);
    Sentry.captureException(err, { tags: { feature: 'places' } });
    return null;
  }

  const address = deduplicateAddress(
    [geo.name, geo.street, geo.city, geo.country].filter(Boolean).join(', '),
  );
  const city = geo.city ?? undefined;
  const country = geo.country ?? undefined;
  const isBusinessName = checkIsBusinessName(geo);

  if (isBusinessName && GOOGLE_PLACES_API_KEY) {
    const googleResult = await searchGooglePlaces(geo.name!, city, latitude, longitude);
    if (googleResult) {
      return { name: googleResult.name, address: googleResult.address || address, city: googleResult.city || city, country: googleResult.country || country };
    }
  }

  if (isBusinessName) {
    return { name: geo.name!, address, city, country };
  }

  if (GOOGLE_PLACES_API_KEY) {
    const googleResult = await searchGooglePlaces(geo.name ?? geo.street ?? '', city, latitude, longitude);
    if (googleResult) {
      return { name: googleResult.name, address: googleResult.address || address, city: googleResult.city || city, country: googleResult.country || country };
    }
  }

  return { name: geo.name ?? geo.street ?? 'Unknown', address, city, country };
}

function checkIsBusinessName(geo: Location.LocationGeocodedAddress): boolean {
  const streetPatterns = /^(carrera|calle|avenida|av\.|cra\.|cl\.|transversal|diagonal|autopista|km\s)/i;
  return Boolean(
    geo.name
    && geo.name !== geo.street
    && geo.name !== geo.streetNumber
    && !/^\d/.test(geo.name)
    && !streetPatterns.test(geo.name),
  );
}

async function searchGooglePlaces(
  nativeName: string,
  city: string | undefined,
  latitude: number,
  longitude: number
): Promise<PlaceResult | null> {
  // Strategy 1: Nearby Search for restaurants
  const nearby = await googleNearbySearch(latitude, longitude);
  if (nearby) return nearby;

  // Strategy 2: Text Search with address + city
  if (nativeName) {
    const query = city ? `${nativeName} ${city}` : nativeName;
    const textResult = await googleTextSearch(query, latitude, longitude);
    if (textResult) return textResult;
  }

  return null;
}

async function googleNearbySearch(
  latitude: number,
  longitude: number
): Promise<PlaceResult | null> {
  try {
    const params = new URLSearchParams({
      location: `${latitude},${longitude}`,
      radius: '300',
      type: 'restaurant',
      key: GOOGLE_PLACES_API_KEY,
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`
    );
    if (!response.ok) return null;

    const data = await response.json();
    const place = data.results?.[0];
    if (!place) return null;

    return parseGooglePlace(place);
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: 'places', method: 'nearbySearch' } });
    return null;
  }
}

async function googleTextSearch(
  query: string,
  latitude: number,
  longitude: number
): Promise<PlaceResult | null> {
  try {
    const params = new URLSearchParams({
      query,
      location: `${latitude},${longitude}`,
      radius: '500',
      type: 'restaurant',
      key: GOOGLE_PLACES_API_KEY,
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`
    );
    if (!response.ok) return null;

    const data = await response.json();
    const place = data.results?.[0];
    if (!place) return null;

    return parseGooglePlace(place);
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: 'places', method: 'textSearch' } });
    return null;
  }
}

function parseGooglePlace(place: GooglePlaceResult): PlaceResult {
  const components = place.address_components ?? [];
  const city = components.find((component) => component.types?.includes('locality'))?.long_name;
  const country = components.find((component) => component.types?.includes('country'))?.long_name;

  return {
    name: place.name,
    address: place.formatted_address ? deduplicateAddress(place.formatted_address) : undefined,
    city,
    country,
  };
}
