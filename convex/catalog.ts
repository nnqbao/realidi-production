import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { toCategory, toMood, toStyle } from "./_lib/dtos";
import { normalizeSearchText } from "./_lib/search";

export function rankingConfigFromDoc(doc: {
  mood_match_weight: number;
  trust_weight: number;
  freshness_weight: number;
  proximity_weight: number;
  quality_engagement_weight: number;
  bayesian_prior_mean: number;
  bayesian_prior_strength: number;
  save_weight: number;
  been_there_weight: number;
  share_weight: number;
  like_weight: number;
  freshness_half_life_days: number;
  min_samples_early: number;
  min_samples_medium: number;
  editorial_cold_start_weight: number;
  geofence_radius_meters: number;
}) {
  return {
    moodMatchWeight: doc.mood_match_weight,
    trustWeight: doc.trust_weight,
    freshnessWeight: doc.freshness_weight,
    proximityWeight: doc.proximity_weight,
    qualityEngagementWeight: doc.quality_engagement_weight,
    bayesianPriorMean: doc.bayesian_prior_mean,
    bayesianPriorStrength: doc.bayesian_prior_strength,
    saveWeight: doc.save_weight,
    beenThereWeight: doc.been_there_weight,
    shareWeight: doc.share_weight,
    likeWeight: doc.like_weight,
    freshnessHalfLifeDays: doc.freshness_half_life_days,
    minSamplesEarly: doc.min_samples_early,
    minSamplesMedium: doc.min_samples_medium,
    editorialColdStartWeight: doc.editorial_cold_start_weight,
    geofenceRadiusMeters: doc.geofence_radius_meters,
  };
}

export function feedRankingConfigFromDoc(doc: {
  social_affinity_weight: number;
  content_relevance_weight: number;
  recency_weight: number;
  verified_weight: number;
  quality_engagement_weight: number;
  mood_context_weight: number;
  location_weight: number;
  save_weight: number;
  comment_weight: number;
  share_weight: number;
  like_weight: number;
  recency_half_life_hours: number;
}) {
  return {
    socialAffinityWeight: doc.social_affinity_weight,
    contentRelevanceWeight: doc.content_relevance_weight,
    recencyWeight: doc.recency_weight,
    verifiedWeight: doc.verified_weight,
    qualityEngagementWeight: doc.quality_engagement_weight,
    moodContextWeight: doc.mood_context_weight,
    locationWeight: doc.location_weight,
    saveWeight: doc.save_weight,
    commentWeight: doc.comment_weight,
    shareWeight: doc.share_weight,
    likeWeight: doc.like_weight,
    recencyHalfLifeHours: doc.recency_half_life_hours,
  };
}

export const desiredMoods = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("moods")
      .withIndex("by_layer_active_order", (q) =>
        q.eq("layer", "desired_feeling").eq("is_active", true))
      .collect();
    return rows.sort((a, b) => a.sort_order - b.sort_order).map(toMood);
  },
});

export const currentStateMoods = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("moods")
      .withIndex("by_layer_active_order", (q) =>
        q.eq("layer", "current_state").eq("is_active", true))
      .collect();
    return rows.sort((a, b) => a.sort_order - b.sort_order).map(toMood);
  },
});

export const styles = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("experience_styles")
      .withIndex("by_active_order", (q) => q.eq("is_active", true))
      .collect();
    return rows.sort((a, b) => a.sort_order - b.sort_order).map(toStyle);
  },
});

export const categories = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("place_categories")
      .withIndex("by_active_order", (q) => q.eq("is_active", true))
      .collect();
    return rows.sort((a, b) => a.sort_order - b.sort_order).map(toCategory);
  },
});

export const moodById = query({
  args: { id: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.id) return null;
    try {
      const doc = await ctx.db.get(args.id as Id<"moods">);
      if (doc === null || !doc.is_active) return null;
      return toMood(doc);
    } catch {
      return null;
    }
  },
});

export const rankingConfig = query({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db
      .query("ranking_config")
      .withIndex("by_seed_key", (q) => q.eq("seed_key", "ranking:default"))
      .unique();
    return doc ? rankingConfigFromDoc(doc) : null;
  },
});

export const feedRankingConfig = query({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db
      .query("feed_ranking_config")
      .withIndex("by_seed_key", (q) => q.eq("seed_key", "feed-ranking:default"))
      .unique();
    return doc ? feedRankingConfigFromDoc(doc) : null;
  },
});

export const searchMoods = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const needle = normalizeSearchText(args.query);
    if (!needle) return [];
    const rows = await ctx.db
      .query("moods")
      .withIndex("by_active_order", (q) => q.eq("is_active", true))
      .collect();
    return rows
      .filter((row) =>
        normalizeSearchText(`${row.name_vi} ${row.name_en} ${row.slug}`).includes(needle))
      .slice(0, 12)
      .map((row) => ({
        id: row._id,
        slug: row.slug,
        name_vi: row.name_vi,
        name_en: row.name_en,
        layer: row.layer,
      }));
  },
});

export const searchCategories = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const needle = normalizeSearchText(args.query);
    if (!needle) return [];
    const rows = await ctx.db
      .query("place_categories")
      .withIndex("by_active_order", (q) => q.eq("is_active", true))
      .collect();
    return rows
      .filter((row) =>
        normalizeSearchText(`${row.name_vi} ${row.name_en} ${row.slug}`).includes(needle))
      .slice(0, 12)
      .map((row) => ({
        id: row._id,
        slug: row.slug,
        name_vi: row.name_vi,
        name_en: row.name_en,
      }));
  },
});
