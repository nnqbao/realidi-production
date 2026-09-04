import { describe, expect, it } from "vitest";
import { api } from "@/convex/_generated/api";
import { seedDatabase } from "@/convex/seed";
import { authHarness } from "./auth-harness";

describe("discovery reads", () => {
  it("ranks all 22 seeded HCMC places for guests", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const { places, config } = await t.query(api.discovery.discover, {});
    expect(places).toHaveLength(22);
    expect(config.moodMatchWeight).toBe(0.45);
    expect(places.map((place) => place.rankingPosition)).toEqual(
      Array.from({ length: 22 }, (_, i) => i + 1),
    );
    const ids = places.map((place) => place.id);
    expect(new Set(ids).size).toBe(22);
    expect(places.every((place) => place.status === "active")).toBe(true);
    expect(places.every((place) => place.latitude != null && place.longitude != null)).toBe(true);
  });

  it("filters by category and keeps ranking deterministic", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const categories = await t.query(api.catalog.categories, {});
    const cafe = categories.find((category) => category.slug === "cafe")!;
    const first = await t.query(api.discovery.discover, { categoryId: cafe.id });
    const second = await t.query(api.discovery.discover, { categoryId: cafe.id });
    expect(first.places.length).toBeGreaterThan(0);
    expect(first.places.length).toBeLessThan(22);
    expect(first.places.every((place) => place.category_id === cafe.id)).toBe(true);
    expect(first.places.map((place) => place.id)).toEqual(second.places.map((place) => place.id));
  });

  it("applies a nearby radius around central Saigon", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const near = await t.query(api.discovery.discover, {
      nearLat: 10.7736,
      nearLng: 106.7057,
      radiusMeters: 1500,
    });
    expect(near.places.length).toBeGreaterThan(0);
    expect(near.places.length).toBeLessThan(22);
    expect(near.places.every((place) => place.distanceMeters != null && place.distanceMeters <= 1500)).toBe(true);
  });
});
