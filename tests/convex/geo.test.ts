import { describe, expect, it } from "vitest";
import {
  assertCoordinateE6, degreesToE6, haversineMetersE6, roundedDistanceMeters,
} from "@/convex/_lib/geo";
import { haversineMeters } from "@/lib/geo/distance";
import { GEO_PARITY } from "@/tests/fixtures/geo-parity";

describe("deterministic Convex geospatial foundation", () => {
  it("matches client Haversine semantics after E6 conversion", () => {
    const [lat1, lng1, lat2, lng2] = GEO_PARITY.saigonScale.points;
    const coordinates = [
      degreesToE6(lat1, "latitude"), degreesToE6(lng1, "longitude"),
      degreesToE6(lat2, "latitude"), degreesToE6(lng2, "longitude"),
    ] as const;
    const serverDistance = haversineMetersE6(...coordinates);
    const quantizedClientDistance = haversineMeters(
      coordinates[0] / 1_000_000, coordinates[1] / 1_000_000,
      coordinates[2] / 1_000_000, coordinates[3] / 1_000_000,
    );
    expect(serverDistance).toBeCloseTo(quantizedClientDistance, 9);
    expect(roundedDistanceMeters(...coordinates)).toBe(Math.round(serverDistance));
  });

  it("accepts inclusive world boundaries", () => {
    expect(() => assertCoordinateE6(-90_000_000, -180_000_000)).not.toThrow();
    expect(() => assertCoordinateE6(90_000_000, 180_000_000)).not.toThrow();
  });

  it("rejects fractions, non-finite values, and out-of-range coordinates", () => {
    for (const [lat, lng] of [
      [90_000_001, 0], [-90_000_001, 0], [0, 180_000_001],
      [0, -180_000_001], [1.5, 2], [Number.NaN, 0],
    ]) {
      expect(() => assertCoordinateE6(lat, lng)).toThrow();
    }
    expect(() => degreesToE6(90.000001, "latitude")).toThrow();
    expect(() => degreesToE6(Number.POSITIVE_INFINITY, "longitude")).toThrow();
  });
});
