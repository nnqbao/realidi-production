import { degreesToE6, haversineMetersE6 } from "./geo";

export type GeofenceResult = {
  withinFence: boolean;
  distanceMeters: number;
  confidence: number;
  result: "verified" | "failed";
  reason: "within_fence" | "outside_fence" | "poor_accuracy" | "invalid_coordinates";
};

const POOR_ACCURACY_FACTOR = 2;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function evaluateGeofenceE6(input: {
  userLatitude: number;
  userLongitude: number;
  placeLatitudeE6: number;
  placeLongitudeE6: number;
  radiusMeters: number;
  accuracyMeters?: number | null;
}): GeofenceResult {
  const { userLatitude, userLongitude, radiusMeters } = input;
  if (
    !Number.isFinite(userLatitude) ||
    !Number.isFinite(userLongitude) ||
    userLatitude < -90 ||
    userLatitude > 90 ||
    userLongitude < -180 ||
    userLongitude > 180 ||
    radiusMeters <= 0
  ) {
    return {
      withinFence: false,
      distanceMeters: Number.NaN,
      confidence: 0,
      result: "failed",
      reason: "invalid_coordinates",
    };
  }

  const distanceMeters = haversineMetersE6(
    degreesToE6(userLatitude, "latitude"),
    degreesToE6(userLongitude, "longitude"),
    input.placeLatitudeE6,
    input.placeLongitudeE6,
  );
  const accuracy = input.accuracyMeters ?? 0;
  if (accuracy > radiusMeters * POOR_ACCURACY_FACTOR) {
    return {
      withinFence: false,
      distanceMeters: Math.round(distanceMeters * 10) / 10,
      confidence: 0.15,
      result: "failed",
      reason: "poor_accuracy",
    };
  }

  const withinFence = distanceMeters <= radiusMeters;
  const proximity = clamp(1 - distanceMeters / radiusMeters, 0, 1);
  const accuracyFactor =
    accuracy <= 0 ? 0.85 : clamp(1 - accuracy / (radiusMeters * 2), 0.2, 1);
  const confidence = withinFence ? clamp(0.4 + 0.6 * proximity * accuracyFactor, 0, 1) : 0.1;
  return {
    withinFence,
    distanceMeters: Math.round(distanceMeters * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
    result: withinFence ? "verified" : "failed",
    reason: withinFence ? "within_fence" : "outside_fence",
  };
}
