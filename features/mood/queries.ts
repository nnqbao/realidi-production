import { createServerSupabase } from "@/lib/supabase/server";
import { DEFAULT_RANKING_CONFIG, type RankingConfig } from "@/lib/ranking";
import type { ExperienceStyle, Mood, PlaceCategory } from "@/types/database";

export async function getDesiredMoods(): Promise<Mood[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("moods")
    .select("*")
    .eq("is_active", true)
    .eq("layer", "desired_feeling")
    .order("sort_order");
  return (data ?? []) as Mood[];
}

export async function getCurrentStateMoods(): Promise<Mood[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("moods")
    .select("*")
    .eq("is_active", true)
    .eq("layer", "current_state")
    .order("sort_order");
  return (data ?? []) as Mood[];
}

export async function getStyles(): Promise<ExperienceStyle[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("experience_styles")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as ExperienceStyle[];
}

export async function getCategories(): Promise<PlaceCategory[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("place_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as PlaceCategory[];
}

export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("feature_flags").select("key, enabled");
  return Object.fromEntries((data ?? []).map((row) => [row.key, row.enabled]));
}

export async function getRankingConfig(): Promise<RankingConfig> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("ranking_config").select("*").eq("id", "default").maybeSingle();
  if (!data) return DEFAULT_RANKING_CONFIG;
  return {
    moodMatchWeight: Number(data.mood_match_weight),
    trustWeight: Number(data.trust_weight),
    freshnessWeight: Number(data.freshness_weight),
    proximityWeight: Number(data.proximity_weight),
    qualityEngagementWeight: Number(data.quality_engagement_weight),
    bayesianPriorMean: Number(data.bayesian_prior_mean),
    bayesianPriorStrength: Number(data.bayesian_prior_strength),
    saveWeight: Number(data.save_weight),
    beenThereWeight: Number(data.been_there_weight),
    shareWeight: Number(data.share_weight),
    likeWeight: Number(data.like_weight),
    freshnessHalfLifeDays: Number(data.freshness_half_life_days),
    minSamplesEarly: data.min_samples_early,
    minSamplesMedium: data.min_samples_medium,
    editorialColdStartWeight: Number(data.editorial_cold_start_weight),
    geofenceRadiusMeters: data.geofence_radius_meters,
  };
}
