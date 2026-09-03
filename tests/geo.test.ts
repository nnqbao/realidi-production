import { describe, expect, it } from "vitest";
import { haversineMeters, formatDistance, isValidCoordinate } from "@/lib/geo/distance";
import { evaluateGeofence } from "@/lib/geo/geofence";

describe("haversineMeters", () => {
  it("is ~0 for the same point", () => {
    expect(haversineMeters(10.78, 106.7, 10.78, 106.7)).toBeLessThan(1);
  });

  it("measures a known Saigon-scale distance", () => {
    const meters = haversineMeters(10.7769, 106.6954, 10.772, 106.6983);
    expect(meters).toBeGreaterThan(400);
    expect(meters).toBeLessThan(900);
  });
});

describe("formatDistance", () => {
  it("uses meters under 1km", () => {
    expect(formatDistance(180)).toBe("180 m");
  });
});

describe("isValidCoordinate", () => {
  it("rejects out of range", () => {
    expect(isValidCoordinate(95, 10)).toBe(false);
    expect(isValidCoordinate(10.77, 106.7)).toBe(true);
  });
});

describe("evaluateGeofence", () => {
  const place = { placeLatitude: 10.7769, placeLongitude: 106.6954, radiusMeters: 150 };

  it("verifies a point inside the fence", () => {
    const result = evaluateGeofence({
      ...place,
      userLatitude: 10.77695,
      userLongitude: 106.69545,
      accuracyMeters: 12,
    });
    expect(result.result).toBe("verified");
    expect(result.withinFence).toBe(true);
    expect(result.distanceMeters).toBeLessThan(150);
    expect(result.confidence).toBeGreaterThan(0.4);
  });

  it("fails a point well outside the fence", () => {
    const result = evaluateGeofence({
      ...place,
      userLatitude: 10.79,
      userLongitude: 106.72,
      accuracyMeters: 10,
    });
    expect(result.result).toBe("failed");
    expect(result.reason).toBe("outside_fence");
  });

  it("fails when GPS accuracy is unusable", () => {
    const result = evaluateGeofence({
      ...place,
      userLatitude: 10.7769,
      userLongitude: 106.6954,
      accuracyMeters: 500,
    });
    expect(result.result).toBe("failed");
    expect(result.reason).toBe("poor_accuracy");
  });

  it("rejects invalid coordinates", () => {
    const result = evaluateGeofence({
      ...place,
      userLatitude: 999,
      userLongitude: 106,
    });
    expect(result.reason).toBe("invalid_coordinates");
  });
});
