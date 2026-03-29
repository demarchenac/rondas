import * as Location from 'expo-location';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

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
  // Step 1: Try native reverse geocode
  try {
    const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (geo) {
      const address = [geo.name, geo.street, geo.city, geo.country]
        .filter(Boolean)
        .join(', ');
      const city = geo.city ?? undefined;
      const country = geo.country ?? undefined;

      // Check if name looks like a real business (not a street address)
      const streetPatterns = /^(carrera|calle|avenida|av\.|cra\.|cl\.|transversal|diagonal|autopista|km\s)/i;
      const isBusinessName = geo.name
        && geo.name !== geo.street
        && geo.name !== geo.streetNumber
        && !/^\d/.test(geo.name)
        && !streetPatterns.test(geo.name);

      if (isBusinessName) {
        // Native found a business, but try Google for a better match
        if (GOOGLE_PLACES_API_KEY) {
          const gResult = await searchGooglePlaces(geo.name!, city, latitude, longitude);
          if (gResult) {
            return { name: gResult.name, address: gResult.address || address, city: gResult.city || city, country: gResult.country || country };
          }
        }
        return { name: geo.name!, address, city, country };
      }

      // Not a business name — try Google Places
      if (GOOGLE_PLACES_API_KEY) {
        const gResult = await searchGooglePlaces(geo.name ?? geo.street ?? '', city, latitude, longitude);
        if (gResult) {
          return { name: gResult.name, address: gResult.address || address, city: gResult.city || city, country: gResult.country || country };
        }
      }

      return { name: geo.name ?? geo.street ?? 'Unknown', address, city, country };
    }
  } catch (err) {
  }

  // Step 2: If native fails entirely, try Google directly
  if (GOOGLE_PLACES_API_KEY) {
    const gResult = await searchGooglePlaces('', undefined, latitude, longitude);
    if (gResult) return gResult;
  }

  return null;
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
  } catch {
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
  } catch {
    return null;
  }
}

function parseGooglePlace(place: any): PlaceResult {
  const components = place.address_components ?? [];
  const city = components.find((c: any) => c.types?.includes('locality'))?.long_name;
  const country = components.find((c: any) => c.types?.includes('country'))?.long_name;

  return {
    name: place.name,
    address: place.formatted_address,
    city,
    country,
  };
}
