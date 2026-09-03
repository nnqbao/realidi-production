/**
 * Map provider adapter. Mapbox is the initial implementation.
 * The rest of the app must not import Mapbox SDKs directly.
 *
 * If the Mapbox public token is missing, the adapter reports maps as unavailable.
 * Callers must show a consumer-friendly fallback (address + external directions),
 * never a fake interactive map and never the environment variable name.
 */

export type MapProviderName = "mapbox" | "none";

export type DirectionsIntent = {
  latitude: number;
  longitude: number;
  placeName: string;
};

export interface MapProvider {
  name: MapProviderName;
  isConfigured(): boolean;
  publicToken(): string | null;
  staticMapUrl(input: {
    latitude: number;
    longitude: number;
    zoom?: number;
    width?: number;
    height?: number;
  }): string | null;
  directionsUrl(intent: DirectionsIntent): string;
}

function mapboxDirectionsUrl(intent: DirectionsIntent): string {
  const query = encodeURIComponent(`${intent.latitude},${intent.longitude}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
}

export const mapboxProvider: MapProvider = {
  name: "mapbox",
  isConfigured() {
    return Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
  },
  publicToken() {
    return process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? null;
  },
  staticMapUrl({ latitude, longitude, zoom = 14, width = 800, height = 400 }) {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return null;
    return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/pin-s+0d1631(${longitude},${latitude})/${longitude},${latitude},${zoom},0/${width}x${height}@2x?access_token=${token}`;
  },
  directionsUrl: mapboxDirectionsUrl,
};

export const noneProvider: MapProvider = {
  name: "none",
  isConfigured() {
    return false;
  },
  publicToken() {
    return null;
  },
  staticMapUrl() {
    return null;
  },
  directionsUrl: mapboxDirectionsUrl,
};

export function getMapProvider(): MapProvider {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? mapboxProvider : noneProvider;
}
