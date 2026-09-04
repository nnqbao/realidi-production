export const rankingConfig = {
  seed_key: "ranking:default",
  mood_match_weight: 0.45,
  trust_weight: 0.20,
  freshness_weight: 0.15,
  proximity_weight: 0.10,
  quality_engagement_weight: 0.10,
  bayesian_prior_mean: 3.2,
  bayesian_prior_strength: 8,
  save_weight: 4,
  been_there_weight: 3,
  share_weight: 2,
  like_weight: 1,
  freshness_half_life_days: 21,
  min_samples_early: 5,
  min_samples_medium: 20,
  editorial_cold_start_weight: 0.35,
  geofence_radius_meters: 150,
} as const;

export const feedRankingConfig = {
  seed_key: "feed-ranking:default",
  social_affinity_weight: 0.30,
  content_relevance_weight: 0.20,
  recency_weight: 0.15,
  verified_weight: 0.15,
  quality_engagement_weight: 0.10,
  mood_context_weight: 0.05,
  location_weight: 0.05,
  save_weight: 4,
  comment_weight: 3,
  share_weight: 2,
  like_weight: 1,
  recency_half_life_hours: 36,
} as const;

export const featureFlags = [
  ["ENABLE_REAL_COST", true, "Show typical spend when confidence allows"],
  ["ENABLE_MOOD_MAP", false, "Mood map surface (future)"],
  ["ENABLE_TRAVEL_DNA", false, "Travel DNA consumer feature"],
  ["ENABLE_AI_SEARCH", false, "AI conversational search"],
  ["ENABLE_CREATOR_FEATURES", false, "Creator marketplace surfaces"],
  ["ENABLE_GOOGLE_AUTH", false, "Google social login button"],
] as const;
