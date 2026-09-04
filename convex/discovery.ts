import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireVerifiedProfile } from "./_lib/authz";
import {
  HCMC_CITIES,
  PLACE_CANDIDATE_CEILING,
  isDiscoverablePlace,
  toCategory,
  toPlace,
} from "./_lib/dtos";
import { invariant } from "./_lib/errors";
import { haversineMetersE6, degreesToE6 } from "./_lib/geo";
import { matchLabel, rankPlaces, type PlaceRankingInput } from "./_lib/placeRanking";
import { rankingConfigFromDoc } from "./catalog";
import { pairKey } from "./_lib/uniqueness";
import { normalizeSearchText } from "./_lib/search";

const FEED_SAFE = 80;

const DEFAULT_RANKING = rankingConfigFromDoc({
  mood_match_weight: 0.45,
  trust_weight: 0.2,
  freshness_weight: 0.15,
  proximity_weight: 0.1,
  quality_engagement_weight: 0.1,
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
});

export const discover = query({
  args: {
    moodId: v.optional(v.string()),
    nearLat: v.optional(v.number()),
    nearLng: v.optional(v.number()),
    radiusMeters: v.optional(v.number()),
    budgetMax: v.optional(v.number()),
    timeMinutes: v.optional(v.number()),
    crowd: v.optional(v.string()),
    visitContext: v.optional(v.string()),
    categoryId: v.optional(v.string()),
    styleId: v.optional(v.string()),
    query: v.optional(v.string()),
  },
  handler: async (ctx, filters) => {
    const configDoc = await ctx.db
      .query("ranking_config")
      .withIndex("by_seed_key", (q) => q.eq("seed_key", "ranking:default"))
      .unique();
    const config = configDoc ? rankingConfigFromDoc(configDoc) : DEFAULT_RANKING;

    const collected = [];
    for (const city of HCMC_CITIES) {
      const rows = await ctx.db
        .query("places")
        .withIndex("by_city_status", (q) => q.eq("city", city).eq("status", "active"))
        .take(PLACE_CANDIDATE_CEILING);
      collected.push(...rows);
    }
    invariant(
      collected.length <= PLACE_CANDIDATE_CEILING,
      "CANDIDATE_LIMIT_EXCEEDED",
      "Place candidate set exceeds the documented ceiling",
    );

    const places = collected.filter(isDiscoverablePlace);
    const placeMoods = await ctx.db.query("place_moods").collect();
    const moodStats = await ctx.db.query("place_mood_stats").collect();
    const expStats = await ctx.db.query("place_experience_stats").collect();
    const crowdStats = await ctx.db.query("place_crowd_stats").collect();
    const costStats = await ctx.db.query("place_cost_stats").collect();
    const styles = await ctx.db.query("place_styles").collect();
    const saves = await ctx.db.query("saves").collect();
    const claims = await ctx.db.query("visit_claims").collect();
    const posts = await ctx.db
      .query("experience_posts")
      .withIndex("by_feed", (q) => q.eq("status", "published").eq("visibility", "public"))
      .take(FEED_SAFE);

    const saveCounts: Record<string, number> = {};
    for (const row of saves) saveCounts[row.place_id] = (saveCounts[row.place_id] ?? 0) + 1;
    const beenCounts: Record<string, number> = {};
    for (const row of claims) beenCounts[row.place_id] = (beenCounts[row.place_id] ?? 0) + 1;

    const lastByPlace: Record<string, string> = {};
    const likeByPlace: Record<string, number> = {};
    const shareByPlace: Record<string, number> = {};
    const expCount: Record<string, number> = {};
    const verifiedCount: Record<string, number> = {};
    for (const post of posts) {
      if (!post.place_id || post.deleted_at !== undefined) continue;
      const id = post.place_id;
      expCount[id] = (expCount[id] ?? 0) + 1;
      likeByPlace[id] = (likeByPlace[id] ?? 0) + post.like_count;
      shareByPlace[id] = (shareByPlace[id] ?? 0) + post.share_count;
      if (post.verification_status === "verified") {
        verifiedCount[id] = (verifiedCount[id] ?? 0) + 1;
      }
      if (post.published_at !== undefined) {
        const iso = new Date(post.published_at).toISOString();
        if (!lastByPlace[id] || iso > lastByPlace[id]) lastByPlace[id] = iso;
      }
    }

    const categories = new Map(
      (await ctx.db.query("place_categories").collect()).map((row) => [row._id, row]),
    );

    const needle = filters.query ? normalizeSearchText(filters.query) : "";
    const inputs: PlaceRankingInput[] = [];
    const accepted = [];
    for (const p of places) {
      if (filters.categoryId && p.category_id !== filters.categoryId) continue;
      if (
        filters.styleId &&
        !styles.some((s) => s.place_id === p._id && s.style_id === filters.styleId)
      ) {
        continue;
      }
      if (needle) {
        if (!p.normalized_search.includes(needle)) continue;
      }
      if (
        filters.timeMinutes &&
        p.typical_duration_minutes !== undefined &&
        p.typical_duration_minutes > filters.timeMinutes
      ) {
        continue;
      }
      const cost = costStats.find((c) => c.place_id === p._id);
      const spend = cost?.median_spend_per_person ?? p.typical_spend_max;
      if (filters.budgetMax && spend !== undefined && spend > filters.budgetMax) continue;
      const crowd = crowdStats.find((c) => c.place_id === p._id);
      if (filters.crowd && crowd?.dominant_crowd && crowd.dominant_crowd !== filters.crowd) continue;

      let distance: number | null = null;
      if (
        filters.nearLat != null &&
        filters.nearLng != null &&
        p.latitude_e6 !== undefined &&
        p.longitude_e6 !== undefined
      ) {
        distance = haversineMetersE6(
          degreesToE6(filters.nearLat, "latitude"),
          degreesToE6(filters.nearLng, "longitude"),
          p.latitude_e6,
          p.longitude_e6,
        );
        if (filters.radiusMeters && distance > filters.radiusMeters) continue;
      }

      const moodRow = filters.moodId
        ? placeMoods.find((m) => m.place_id === p._id && m.mood_id === filters.moodId)
        : null;
      const stats = filters.moodId
        ? moodStats.find((m) => m.place_id === p._id && m.mood_id === filters.moodId)
        : null;
      const exp = expStats.find((e) => e.place_id === p._id);

      inputs.push({
        id: p._id,
        editorialScore: p.editorial_score,
        adminQualityScore: p.admin_quality_score,
        typicalDurationMinutes: p.typical_duration_minutes ?? null,
        typicalSpendMin: p.typical_spend_min ?? null,
        typicalSpendMax: p.typical_spend_max ?? null,
        priceLevel: p.price_level ?? null,
        categoryId: p.category_id ?? null,
        latitude: p.latitude_e6 !== undefined ? p.latitude_e6 / 1_000_000 : null,
        longitude: p.longitude_e6 !== undefined ? p.longitude_e6 / 1_000_000 : null,
        lastExperienceAt: lastByPlace[p._id] ?? null,
        saveCount: saveCounts[p._id] ?? 0,
        beenThereCount: beenCounts[p._id] ?? 0,
        shareCount: shareByPlace[p._id] ?? 0,
        likeCount: likeByPlace[p._id] ?? 0,
        verifiedExperienceCount: verifiedCount[p._id] ?? 0,
        experienceCount: expCount[p._id] ?? 0,
        verifiedRatio: exp?.verified_ratio ?? 0,
        mood: filters.moodId
          ? {
              editorialWeight: moodRow?.weight ?? 0,
              avgRating: stats?.avg_rating ?? null,
              smoothedRating: stats?.smoothed_rating ?? null,
              sampleCount: stats?.sample_count ?? 0,
              verifiedSampleCount: stats?.verified_sample_count ?? 0,
            }
          : {
              editorialWeight: p.editorial_score,
              avgRating: null,
              smoothedRating: null,
              sampleCount: 0,
              verifiedSampleCount: 0,
            },
        crowd: crowd?.dominant_crowd ?? null,
        medianSpend: spend !== undefined ? spend : null,
      });
      accepted.push(p);
    }

    const ranked = rankPlaces(inputs, {
      userLat: filters.nearLat ?? null,
      userLng: filters.nearLng ?? null,
      radiusMeters: filters.radiusMeters ?? 12_000,
      config,
    });
    const byId = new Map(accepted.map((p) => [p._id as string, p]));
    const cards = ranked.map((row) => {
      const p = byId.get(row.id)!;
      const cost = costStats.find((c) => c.place_id === p._id);
      const crowd = crowdStats.find((c) => c.place_id === p._id);
      const exp = expStats.find((e) => e.place_id === p._id);
      let distance: number | null = null;
      if (
        filters.nearLat != null &&
        filters.nearLng != null &&
        p.latitude_e6 !== undefined &&
        p.longitude_e6 !== undefined
      ) {
        distance = haversineMetersE6(
          degreesToE6(filters.nearLat, "latitude"),
          degreesToE6(filters.nearLng, "longitude"),
          p.latitude_e6,
          p.longitude_e6,
        );
      }
      const category = p.category_id ? categories.get(p.category_id) : null;
      return {
        ...toPlace(p),
        category: category ? toCategory(category) : null,
        distanceMeters: distance,
        match: matchLabel(row.ranking.moodTier, row.ranking.moodMatch),
        moodScore: row.ranking.moodMatch,
        verifiedRatio: exp?.verified_ratio ?? 0,
        verifiedCount: verifiedCount[p._id] ?? 0,
        crowd: crowd?.dominant_crowd ?? null,
        crowdTier: crowd?.tier ?? "early_signal",
        typicalSpend: cost?.median_spend_per_person ?? p.typical_spend_min ?? null,
        spendTier: cost?.tier ?? "early_signal",
        rankingPosition: row.position,
        reasons: row.ranking.reasons,
        moodTier: row.ranking.moodTier,
        experienceCount: expCount[p._id] ?? 0,
        bestContext: exp?.best_visit_context ?? null,
        bestTime: exp?.best_time_period ?? null,
        isEditorialPick: p.verified_by_admin || p.editorial_score >= 0.84,
      };
    });

    return { places: cards, config };
  },
});

export const submitFeedback = mutation({
  args: {
    placeId: v.id("places"),
    moodId: v.optional(v.id("moods")),
    kind: v.union(v.literal("fit"), v.literal("wrong_mood")),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const key = pairKey(profile._id, args.placeId);
    const existing = await ctx.db
      .query("place_recommendation_feedback")
      .withIndex("by_pair", (q) => q.eq("pair_key", key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { kind: args.kind, mood_id: args.moodId });
    } else {
      await ctx.db.insert("place_recommendation_feedback", {
        user_id: profile._id,
        place_id: args.placeId,
        mood_id: args.moodId,
        pair_key: key,
        kind: args.kind,
        created_at: Date.now(),
      });
    }
    return { ok: true as const };
  },
});
