import { describe, expect, it } from "vitest";
import { formatCompactVnd } from "@/lib/utils";
import { whyThisMatchLines } from "@/lib/discovery/why-this-match";
import { buildExploreShelves, type ExploreShelfPlace } from "@/lib/discovery/shelves";
import { experienceSignalCopy, confidenceHeadline } from "@/lib/presentation/match";
import { communityFavoriteTimeCopy } from "@/lib/presentation/time";
import { parseSearchIntent } from "@/lib/search";

function place(partial: Partial<ExploreShelfPlace> & Pick<ExploreShelfPlace, "id">): ExploreShelfPlace {
  return {
    match: "good_match",
    moodScore: 0.6,
    distanceMeters: 800,
    typicalSpend: 120_000,
    spendTier: "emerging",
    bestContext: "friends",
    experienceCount: 8,
    verifiedCount: 4,
    isEditorialPick: false,
    rankingPosition: 1,
    ...partial,
  };
}

describe("formatCompactVnd", () => {
  it("formats zero as Miễn phí", () => {
    expect(formatCompactVnd(0)).toBe("Miễn phí");
  });
});

describe("whyThisMatchLines", () => {
  it("is deterministic from platform data", () => {
    const a = whyThisMatchLines({
      moodName: "An yên",
      reasons: ["mood_strong"],
      crowd: "quiet",
      bestContext: "solo",
      bestTime: "morning",
      typicalSpend: 90000,
      budgetMax: 150000,
      verifiedCount: 6,
      isEditorialPick: false,
      distanceMeters: 400,
    });
    const b = whyThisMatchLines({
      moodName: "An yên",
      reasons: ["mood_strong"],
      crowd: "quiet",
      bestContext: "solo",
      bestTime: "morning",
      typicalSpend: 90000,
      budgetMax: 150000,
      verifiedCount: 6,
      isEditorialPick: false,
      distanceMeters: 400,
    });
    expect(a).toEqual(b);
    expect(a[0]).toBe("Phù hợp với mood An yên");
    expect(a).toContain("Thường yên vào buổi sáng");
  });
});

describe("buildExploreShelves", () => {
  it("does not repeat a place across shelves", () => {
    const places = [
      place({ id: "a", moodScore: 0.9, isEditorialPick: true, bestContext: "solo", experienceCount: 12 }),
      place({ id: "b", moodScore: 0.8, distanceMeters: 200, experienceCount: 9 }),
      place({ id: "c", moodScore: 0.7, typicalSpend: 80_000, experienceCount: 5 }),
      place({ id: "d", moodScore: 0.4, isEditorialPick: true, experienceCount: 3 }),
    ];
    const shelves = buildExploreShelves(places, { moodSelected: true, hasLocation: true, budgetMax: 300_000 });
    const ids = shelves.flatMap((s) => s.places.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("experienceSignalCopy", () => {
  it("does not imply strong confidence from a tiny sample", () => {
    const copy = experienceSignalCopy({
      match: "strong_match",
      confidenceTier: "early_signal",
      experienceCount: 2,
      verifiedCount: 2,
    });
    expect(copy.match).toBe(confidenceHeadline("early_signal"));
    expect(copy.signal).toContain("2 trải nghiệm");
    expect(copy.signal).not.toMatch(/\d+\.\d+/);
  });
});

describe("communityFavoriteTimeCopy", () => {
  it("hides time intelligence until there is enough data", () => {
    expect(
      communityFavoriteTimeCopy({
        sampleCount: 3,
        tier: "early_signal",
        favoriteDayType: "weekend",
        favoriteTimePeriod: "morning",
      }),
    ).toBeNull();
    expect(
      communityFavoriteTimeCopy({
        sampleCount: 12,
        tier: "established",
        favoriteDayType: "weekend",
        favoriteTimePeriod: "morning",
      }),
    ).toBe("buổi sáng · cuối tuần");
  });
});

describe("parseSearchIntent", () => {
  it("keeps MVP search as keyword mode", () => {
    const intent = parseSearchIntent("quán cà phê yên tĩnh quận 1");
    expect(intent.mode).toBe("keyword");
    expect(intent.text).toContain("cà phê");
  });
});
