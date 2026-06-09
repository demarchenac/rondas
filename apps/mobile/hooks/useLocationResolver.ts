import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import * as Location from 'expo-location';
import { resolvePlace } from '@/lib/places';

interface PlaceData {
  placeName?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export function useLocationResolver(
  resolveLocation: 'device' | 'exif' | undefined,
  latitude?: string,
  longitude?: string,
): PlaceData {
  const [placeData, setPlaceData] = useState<PlaceData>({});

  useEffect(() => {
    if (!resolveLocation) return;

    let cancelled = false;

    async function resolve() {
      try {
        if (resolveLocation === 'device') {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted' || cancelled) return;
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (cancelled) return;
          const place = await resolvePlace(loc.coords.latitude, loc.coords.longitude);
          if (cancelled) return;
          setPlaceData({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            placeName: place?.name,
            address: place?.address,
          });
          return;
        }

        if (resolveLocation === 'exif' && latitude && longitude) {
          const parsedLat = parseFloat(latitude);
          const parsedLng = parseFloat(longitude);
          const place = await resolvePlace(parsedLat, parsedLng);
          if (cancelled) return;
          setPlaceData({
            latitude: parsedLat,
            longitude: parsedLng,
            placeName: place?.name,
            address: place?.address,
          });
        }
      } catch (err) {
        console.warn('[NewBill] location resolve failed:', err);
        Sentry.captureException(err, { tags: { feature: 'new_bill' } });
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [resolveLocation, latitude, longitude]);

  return placeData;
}
