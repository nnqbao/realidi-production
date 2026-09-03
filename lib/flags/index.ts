export const FEATURE_FLAG_KEYS = [
  "ENABLE_REAL_COST",
  "ENABLE_MOOD_MAP",
  "ENABLE_TRAVEL_DNA",
  "ENABLE_AI_SEARCH",
  "ENABLE_CREATOR_FEATURES",
  "ENABLE_GOOGLE_AUTH",
  "ENABLE_MAP",
] as const;

export function isMapNavEnabled() {
  if (process.env.NEXT_PUBLIC_ENABLE_MAP === "false" || process.env.ENABLE_MAP === "false") return false;
  return Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
}

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export function isFlagEnabled(
  flags: Record<string, boolean>,
  key: FeatureFlagKey,
): boolean {
  return Boolean(flags[key]);
}
