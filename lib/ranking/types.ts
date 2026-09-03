export type ConfidenceTier = "early_signal" | "emerging" | "established";

export type RankingConfig = {
  moodMatchWeight: number;
  trustWeight: number;
  freshnessWeight: number;
  proximityWeight: number;
  qualityEngagementWeight: number;
  bayesianPriorMean: number;
  bayesianPriorStrength: number;
  saveWeight: number;
  beenThereWeight: number;
  shareWeight: number;
  likeWeight: number;
  freshnessHalfLifeDays: number;
  minSamplesEarly: number;
  minSamplesMedium: number;
  editorialColdStartWeight: number;
  geofenceRadiusMeters: number;
};

export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  moodMatchWeight: 0.45,
  trustWeight: 0.2,
  freshnessWeight: 0.15,
  proximityWeight: 0.1,
  qualityEngagementWeight: 0.1,
  bayesianPriorMean: 3.2,
  bayesianPriorStrength: 8,
  saveWeight: 4,
  beenThereWeight: 3,
  shareWeight: 2,
  likeWeight: 1,
  freshnessHalfLifeDays: 21,
  minSamplesEarly: 5,
  minSamplesMedium: 20,
  editorialColdStartWeight: 0.35,
  geofenceRadiusMeters: 150,
};

export type PlaceRankingInput = {
  id: string;
  editorialScore: number;
  adminQualityScore: number;
  typicalDurationMinutes: number | null;
  typicalSpendMin: number | null;
  typicalSpendMax: number | null;
  priceLevel: number | null;
  categoryId: string | null;
  latitude: number | null;
  longitude: number | null;
  lastExperienceAt: string | null;
  saveCount: number;
  beenThereCount: number;
  shareCount: number;
  likeCount: number;
  verifiedExperienceCount: number;
  experienceCount: number;
  verifiedRatio: number;
  mood: {
    editorialWeight: number;
    avgRating: number | null;
    smoothedRating: number | null;
    sampleCount: number;
    verifiedSampleCount: number;
  } | null;
  crowd: string | null;
  medianSpend: number | null;
};

export type RankExplanation = {
  moodMatch: number;
  trust: number;
  freshness: number;
  proximity: number;
  qualityEngagement: number;
  total: number;
  moodTier: ConfidenceTier;
  reasons: string[];
};

export type DiscoveryFilters = {
  moodId: string | null;
  nearLat: number | null;
  nearLng: number | null;
  radiusMeters: number | null;
  budgetMax: number | null;
  timeMinutes: number | null;
  crowd: string | null;
  visitContext: string | null;
  categoryId: string | null;
  styleId: string | null;
  query: string | null;
};
