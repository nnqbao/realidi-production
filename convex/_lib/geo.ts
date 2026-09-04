import { invariant } from "./errors";

export const EARTH_RADIUS_METERS = 6_371_000;
export const E6 = 1_000_000;

export function assertCoordinateE6(latitudeE6: number, longitudeE6: number): void {
  invariant(
    Number.isSafeInteger(latitudeE6) && latitudeE6 >= -90 * E6 && latitudeE6 <= 90 * E6,
    "VALIDATION_FAILED",
    "latitude_e6 must be a safe integer from -90000000 through 90000000",
  );
  invariant(
    Number.isSafeInteger(longitudeE6) && longitudeE6 >= -180 * E6 && longitudeE6 <= 180 * E6,
    "VALIDATION_FAILED",
    "longitude_e6 must be a safe integer from -180000000 through 180000000",
  );
}

export function degreesToE6(value: number, axis: "latitude" | "longitude"): number {
  const limit = axis === "latitude" ? 90 : 180;
  invariant(Number.isFinite(value) && value >= -limit && value <= limit,
    "VALIDATION_FAILED", `${axis} is out of range`);
  return Math.round(value * E6);
}

export function haversineMetersE6(
  latitudeE6A: number,
  longitudeE6A: number,
  latitudeE6B: number,
  longitudeE6B: number,
): number {
  assertCoordinateE6(latitudeE6A, longitudeE6A);
  assertCoordinateE6(latitudeE6B, longitudeE6B);
  const toRadians = (e6: number) => (e6 / E6) * Math.PI / 180;
  const latA = toRadians(latitudeE6A);
  const latB = toRadians(latitudeE6B);
  const deltaLat = latB - latA;
  const deltaLng = toRadians(longitudeE6B - longitudeE6A);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function roundedDistanceMeters(
  latitudeE6A: number,
  longitudeE6A: number,
  latitudeE6B: number,
  longitudeE6B: number,
): number {
  return Math.round(haversineMetersE6(latitudeE6A, longitudeE6A, latitudeE6B, longitudeE6B));
}
