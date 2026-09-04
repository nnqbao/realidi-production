import { haversineMetersE6, degreesToE6 } from "./geo";

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

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function bayesianSmooth(
  average: number,
  sampleCount: number,
  priorMean: number,
  priorStrength: number,
): number {
  if (sampleCount <= 0) return priorMean;
  return (priorStrength * priorMean + sampleCount * average) / (priorStrength + sampleCount);
}

export function confidenceTier(sampleCount: number, config: RankingConfig): ConfidenceTier {
  if (sampleCount < config.minSamplesEarly) return "early_signal";
  if (sampleCount < config.minSamplesMedium) return "emerging";
  return "established";
}

export function freshnessScore(lastActivityAt: string | null, now: Date, halfLifeDays: number): number {
  if (!lastActivityAt) return 0.28;
  const ageDays = (now.getTime() - new Date(lastActivityAt).getTime()) / 86_400_000;
  if (ageDays < 0) return 1;
  return Math.pow(0.5, ageDays / halfLifeDays);
}

export function proximityScore(
  placeLat: number | null,
  placeLng: number | null,
  userLat: number | null,
  userLng: number | null,
  radiusMeters = 12_000,
): number {
  if (placeLat == null || placeLng == null || userLat == null || userLng == null) return 0.5;
  const d = haversineMetersE6(
    degreesToE6(placeLat, "latitude"),
    degreesToE6(placeLng, "longitude"),
    degreesToE6(userLat, "latitude"),
    degreesToE6(userLng, "longitude"),
  );
  if (d >= radiusMeters) return 0;
  return clamp(1 - d / radiusMeters, 0, 1);
}

export function moodMatchScore(place: PlaceRankingInput, config: RankingConfig): number {
  const mood = place.mood;
  if (!mood) {
    return place.editorialScore * 0.45 + place.adminQualityScore * 0.2;
  }
  const community =
    mood.sampleCount > 0
      ? bayesianSmooth(
          mood.avgRating ?? config.bayesianPriorMean,
          mood.sampleCount,
          config.bayesianPriorMean,
          config.bayesianPriorStrength,
        ) / 5
      : 0;
  const editorial = clamp(mood.editorialWeight, 0, 1) * (0.6 * place.editorialScore + 0.4 * place.adminQualityScore);
  if (mood.sampleCount === 0) return editorial;
  const communityWeight = Math.min(0.85, mood.sampleCount / (mood.sampleCount + config.bayesianPriorStrength));
  return communityWeight * community + (1 - communityWeight) * Math.max(editorial, config.editorialColdStartWeight * place.editorialScore);
}

export function trustScore(place: PlaceRankingInput): number {
  const ratio = clamp(place.verifiedRatio, 0, 1);
  const volume = 1 - Math.exp(-(place.verifiedExperienceCount || 0) / 8);
  if (place.experienceCount === 0) {
    return 0.35 * place.adminQualityScore + 0.15 * place.editorialScore;
  }
  return 0.65 * ratio + 0.35 * volume;
}

export function qualityEngagementScore(place: PlaceRankingInput, config: RankingConfig): number {
  const raw =
    place.saveCount * config.saveWeight +
    place.beenThereCount * config.beenThereWeight +
    place.shareCount * config.shareWeight +
    place.likeCount * config.likeWeight;
  return clamp(Math.log(1 + raw) / Math.log(1 + 80), 0, 1);
}

export function rankPlace(
  place: PlaceRankingInput,
  options: {
    userLat?: number | null;
    userLng?: number | null;
    radiusMeters?: number;
    now?: Date;
    config: RankingConfig;
  },
): RankExplanation {
  const { config } = options;
  const now = options.now ?? new Date();
  const moodMatch = clamp(moodMatchScore(place, config), 0, 1);
  const trust = clamp(trustScore(place), 0, 1);
  const freshness = clamp(freshnessScore(place.lastExperienceAt, now, config.freshnessHalfLifeDays), 0, 1);
  const proximity = proximityScore(
    place.latitude,
    place.longitude,
    options.userLat ?? null,
    options.userLng ?? null,
    options.radiusMeters ?? 12_000,
  );
  const qualityEngagement = qualityEngagementScore(place, config);
  const total =
    config.moodMatchWeight * moodMatch +
    config.trustWeight * trust +
    config.freshnessWeight * freshness +
    config.proximityWeight * proximity +
    config.qualityEngagementWeight * qualityEngagement;
  const moodTier = confidenceTier(place.mood?.sampleCount ?? 0, config);
  const reasons: string[] = [];
  if (moodMatch >= 0.7) reasons.push("mood_strong");
  else if (moodMatch >= 0.45) reasons.push("mood_moderate");
  if (place.verifiedExperienceCount >= 3 && place.verifiedRatio >= 0.4) reasons.push("verified_signal");
  if ((place.mood?.sampleCount ?? 0) < config.minSamplesEarly) reasons.push("editorial_supported");
  if (proximity >= 0.7 && options.userLat != null) reasons.push("nearby");
  return { moodMatch, trust, freshness, proximity, qualityEngagement, total, moodTier, reasons };
}

export function rankPlaces(
  places: PlaceRankingInput[],
  options: Parameters<typeof rankPlace>[1],
): Array<PlaceRankingInput & { ranking: RankExplanation; position: number }> {
  return [...places]
    .map((place) => ({ place, ranking: rankPlace(place, options) }))
    .sort((a, b) => b.ranking.total - a.ranking.total || a.place.id.localeCompare(b.place.id))
    .map((row, index) => ({ ...row.place, ranking: row.ranking, position: index + 1 }));
}

export function matchLabel(tier: ConfidenceTier, score: number): "early_signal" | "good_match" | "strong_match" {
  if (tier === "early_signal") return "early_signal";
  if (tier === "established" && score >= 0.62) return "strong_match";
  if (score >= 0.5) return "good_match";
  return "early_signal";
}
