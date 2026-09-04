import type { PlaceRankingInput } from "@/lib/ranking";

export const RANKING_NOW = new Date("2026-08-30T12:00:00.000Z");

export const BASELINE_PLACE: PlaceRankingInput = {
  id: "baseline",
  editorialScore: 0.5,
  adminQualityScore: 0.5,
  typicalDurationMinutes: 60,
  typicalSpendMin: 50_000,
  typicalSpendMax: 150_000,
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
};

export const BASELINE_RANKING = {
  moodMatch: 0.325,
  trust: 0.25,
  freshness: 0.28,
  proximity: 0.5,
  qualityEngagement: 0,
  total: 0.28825000000000006,
  moodTier: "early_signal",
  reasons: ["editorial_supported"],
} as const;
