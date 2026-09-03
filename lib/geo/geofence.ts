import { clamp } from "@/lib/utils";
import { haversineMeters, isValidCoordinate } from "./distance";

export type GeofenceInput = {
  userLatitude: number;
  userLongitude: number;
  placeLatitude: number;
  placeLongitude: number;
  radiusMeters: number;
  accuracyMeters?: number | null;
};

export type GeofenceResult = {
  withinFence: boolean;
  distanceMeters: number;
  confidence: number;
  result: "verified" | "failed";
  reason: "within_fence" | "outside_fence" | "poor_accuracy" | "invalid_coordinates";
};

const POOR_ACCURACY_FACTOR = 2;

/**
 * On-site geo verification.
 * Stores distance + accuracy, never the user's raw coordinates.
 */
export function evaluateGeofence(input: GeofenceInput): GeofenceResult {
  const { userLatitude, userLongitude, placeLatitude, placeLongitude, radiusMeters } =
    input;

  if (
    !isValidCoordinate(userLatitude, userLongitude) ||
    !isValidCoordinate(placeLatitude, placeLongitude) ||
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

  const distanceMeters = haversineMeters(
    userLatitude,
    userLongitude,
    placeLatitude,
    placeLongitude,
  );

  const accuracy = input.accuracyMeters ?? 0;
  if (accuracy > radiusMeters * POOR_ACCURACY_FACTOR) {
    return {
      withinFence: false,
      distanceMeters,
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
