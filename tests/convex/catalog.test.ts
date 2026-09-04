import { describe, expect, it } from "vitest";
import { api } from "@/convex/_generated/api";
import { seedDatabase } from "@/convex/seed";
import { authHarness } from "./auth-harness";

describe("catalog reads", () => {
  it("returns the seeded taxonomy, ranking config, and flags", async () => {
    const t = authHarness();
    await t.run(seedDatabase);

    const [desired, current, styles, categories, ranking, feedRanking, flags] = await Promise.all([
      t.query(api.catalog.desiredMoods, {}),
      t.query(api.catalog.currentStateMoods, {}),
      t.query(api.catalog.styles, {}),
      t.query(api.catalog.categories, {}),
      t.query(api.catalog.rankingConfig, {}),
      t.query(api.catalog.feedRankingConfig, {}),
      t.query(api.flags.all, {}),
    ]);

    expect(desired).toHaveLength(7);
    expect(current).toHaveLength(6);
    expect(styles).toHaveLength(8);
    expect(categories).toHaveLength(10);
    expect(ranking?.moodMatchWeight).toBe(0.45);
    expect(feedRanking?.socialAffinityWeight).toBe(0.3);
    expect(flags.ENABLE_REAL_COST).toBe(true);
    expect(desired.map((mood) => mood.slug)).toContain("peaceful");
    expect(desired.every((mood) => mood.layer === "desired_feeling")).toBe(true);
  });

  it("resolves a mood by Convex id and searches accent-insensitively", async () => {
    const t = authHarness();
    await t.run(seedDatabase);
    const desired = await t.query(api.catalog.desiredMoods, {});
    const peaceful = desired.find((mood) => mood.slug === "peaceful")!;
    const byId = await t.query(api.catalog.moodById, { id: peaceful.id });
    expect(byId?.name_vi).toBe("An yên");

    const hits = await t.query(api.catalog.searchMoods, { query: "AN YEN" });
    expect(hits.some((mood) => mood.slug === "peaceful")).toBe(true);
    const cafe = await t.query(api.catalog.searchCategories, { query: "cà phê" });
    expect(cafe.some((category) => category.slug === "cafe")).toBe(true);
  });
});
