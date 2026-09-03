import { describe, expect, it } from "vitest";
import {
  bayesianSmooth,
  confidenceTier,
  freshnessScore,
  moodMatchScore,
  proximityScore,
  qualityEngagementScore,
  rankPlace,
  rankPlaces,
  trustScore,
  DEFAULT_RANKING_CONFIG,
  type PlaceRankingInput,
} from "@/lib/ranking";

function place(partial: Partial<PlaceRankingInput> & Pick<PlaceRankingInput, "id">): PlaceRankingInput {
  return {
    editorialScore: 0.5,
    adminQualityScore: 0.5,
    typicalDurationMinutes: 60,
    typicalSpendMin: 50000,
    typicalSpendMax: 150000,
    priceLevel: 2,
    categoryId: null,
    latitude: 10.78,
    longitude: 106.7,
    lastExperienceAt: null,
    saveCount: 0,
    beenThereCount: 0,
    shareCount: 0,
    likeCount: 0,
    verifiedExperienceCount: 0,
    experienceCount: 0,
    verifiedRatio: 0,
    mood: null,
    crowd: null,
    medianSpend: null,
    ...partial,
  };
}

describe("bayesianSmooth", () => {
  it("returns the prior when n is 0", () => {
    expect(bayesianSmooth(5, 0, 3.2, 8)).toBe(3.2);
  });

  it("pulls a tiny sample toward the prior", () => {
    const tiny = bayesianSmooth(5, 2, 3.2, 8);
    const large = bayesianSmooth(5, 100, 3.2, 8);
    expect(tiny).toBeLessThan(large);
    expect(tiny).toBeGreaterThan(3.2);
  });
});

describe("confidenceTier", () => {
  it("does not claim established from two ratings", () => {
    expect(confidenceTier(2)).toBe("early_signal");
    expect(confidenceTier(10)).toBe("emerging");
    expect(confidenceTier(25)).toBe("established");
  });
});

describe("freshnessScore", () => {
  it("decays with age", () => {
    const now = new Date("2026-08-30T00:00:00Z");
    const recent = freshnessScore("2026-08-23T00:00:00Z", now, 21);
    const old = freshnessScore("2025-01-01T00:00:00Z", now, 21);
    expect(recent).toBeGreaterThan(old);
  });
});

describe("proximityScore", () => {
  it("is neutral without user location", () => {
    expect(proximityScore(10.78, 106.7, null, null)).toBe(0.5);
  });

  it("is higher when closer", () => {
    const near = proximityScore(10.78, 106.7, 10.781, 106.701, 12000);
    const far = proximityScore(10.78, 106.7, 10.85, 106.8, 12000);
    expect(near).toBeGreaterThan(far);
  });
});

describe("mood ranking", () => {
  it("does not let n=2 outrank n=100 solely on raw average", () => {
    const noisy = place({
      id: "noisy",
      mood: {
        editorialWeight: 0.2,
        avgRating: 5,
        smoothedRating: 4.2,
        sampleCount: 2,
        verifiedSampleCount: 0,
      },
    });
    const solid = place({
      id: "solid",
      mood: {
        editorialWeight: 0.8,
        avgRating: 4.4,
        smoothedRating: 4.3,
        sampleCount: 100,
        verifiedSampleCount: 60,
      },
      verifiedExperienceCount: 60,
      experienceCount: 100,
      verifiedRatio: 0.6,
    });
    expect(moodMatchScore(solid, DEFAULT_RANKING_CONFIG)).toBeGreaterThan(
      moodMatchScore(noisy, DEFAULT_RANKING_CONFIG) - 0.15,
    );
    expect(rankPlace(solid).total).toBeGreaterThan(rankPlace(noisy).total);
  });

  it("uses editorial fallback when a place has no mood ratings", () => {
    const editorial = place({
      id: "ed",
      editorialScore: 0.9,
      adminQualityScore: 0.85,
      mood: {
        editorialWeight: 1,
        avgRating: null,
        smoothedRating: null,
        sampleCount: 0,
        verifiedSampleCount: 0,
      },
    });
    expect(moodMatchScore(editorial, DEFAULT_RANKING_CONFIG)).toBeGreaterThan(0.5);
  });
});

describe("trust and engagement", () => {
  it("rewards verified ratio over like volume", () => {
    const trusted = place({
      id: "t",
      experienceCount: 20,
      verifiedExperienceCount: 16,
      verifiedRatio: 0.8,
      likeCount: 2,
      saveCount: 8,
    });
    const hyped = place({
      id: "h",
      experienceCount: 20,
      verifiedExperienceCount: 1,
      verifiedRatio: 0.05,
      likeCount: 400,
      saveCount: 1,
    });
    expect(trustScore(trusted)).toBeGreaterThan(trustScore(hyped));
    expect(qualityEngagementScore(trusted, DEFAULT_RANKING_CONFIG)).toBeGreaterThan(
      qualityEngagementScore(place({ id: "likes-only", likeCount: 20 }), DEFAULT_RANKING_CONFIG),
    );
  });
});

describe("rankPlaces", () => {
  it("orders by total score and assigns positions", () => {
    const ranked = rankPlaces([
      place({ id: "a", editorialScore: 0.2, mood: { editorialWeight: 0.2, avgRating: 3, smoothedRating: 3, sampleCount: 4, verifiedSampleCount: 0 } }),
      place({
        id: "b",
        editorialScore: 0.9,
        verifiedRatio: 0.7,
        verifiedExperienceCount: 12,
        experienceCount: 16,
        saveCount: 20,
        mood: { editorialWeight: 1, avgRating: 4.5, smoothedRating: 4.4, sampleCount: 16, verifiedSampleCount: 12 },
      }),
    ]);
    expect(ranked[0].id).toBe("b");
    expect(ranked[0].position).toBe(1);
  });
});
