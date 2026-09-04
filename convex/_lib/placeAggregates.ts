import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  bayesianAverage,
  confidenceFromSamples,
  deterministicMedian,
  deterministicMode,
} from "./aggregates";
import { pairKey } from "./uniqueness";

const CROWD = ["quiet", "normal", "busy", "very_busy"] as const;
const CONTEXT = ["solo", "couple", "friends", "family", "work", "other"] as const;
const DAYS = ["weekday", "weekend", "holiday"] as const;
const TIMES = ["morning", "afternoon", "evening", "night"] as const;

function visible(post: {
  status: string;
  deleted_at?: number;
  moderation_status: string;
}): boolean {
  return (
    post.status === "published" &&
    post.deleted_at === undefined &&
    post.moderation_status !== "hidden" &&
    post.moderation_status !== "rejected"
  );
}

export async function refreshPlaceAggregates(
  ctx: MutationCtx,
  placeId: Id<"places">,
): Promise<void> {
  const config = await ctx.db
    .query("ranking_config")
    .withIndex("by_seed_key", (q) => q.eq("seed_key", "ranking:default"))
    .unique();
  const priorMean = config?.bayesian_prior_mean ?? 3.2;
  const priorN = config?.bayesian_prior_strength ?? 8;

  const posts = await ctx.db
    .query("experience_posts")
    .withIndex("by_place_published", (q) => q.eq("place_id", placeId))
    .take(80);
  const visiblePosts = posts.filter(visible);

  const existingMood = await ctx.db
    .query("place_mood_stats")
    .withIndex("by_place", (q) => q.eq("place_id", placeId))
    .collect();
  for (const row of existingMood) await ctx.db.delete(row._id);
  const existingExp = await ctx.db
    .query("place_experience_stats")
    .withIndex("by_place", (q) => q.eq("place_id", placeId))
    .unique();
  if (existingExp) await ctx.db.delete(existingExp._id);
  const existingCrowd = await ctx.db
    .query("place_crowd_stats")
    .withIndex("by_place", (q) => q.eq("place_id", placeId))
    .unique();
  if (existingCrowd) await ctx.db.delete(existingCrowd._id);
  const existingCost = await ctx.db
    .query("place_cost_stats")
    .withIndex("by_place", (q) => q.eq("place_id", placeId))
    .unique();
  if (existingCost) await ctx.db.delete(existingCost._id);
  const existingTime = await ctx.db
    .query("place_time_stats")
    .withIndex("by_place", (q) => q.eq("place_id", placeId))
    .unique();
  if (existingTime) await ctx.db.delete(existingTime._id);

  if (visiblePosts.length === 0) return;

  const now = Date.now();
  const moodBuckets = new Map<string, { ratings: number[]; verified: number }>();
  const worth: number[] = [];
  const spend: number[] = [];
  const crowds: Array<(typeof CROWD)[number]> = [];
  const contexts: Array<(typeof CONTEXT)[number]> = [];
  const days: Array<(typeof DAYS)[number]> = [];
  const times: Array<(typeof TIMES)[number]> = [];
  let verifiedPosts = 0;
  let verifiedCrowd = 0;
  let verifiedSpend = 0;
  let verifiedTime = 0;

  for (const post of visiblePosts) {
    const isVerified = post.verification_status === "verified";
    if (isVerified) verifiedPosts += 1;
    if (post.visit_context) contexts.push(post.visit_context);
    const ratings = await ctx.db
      .query("experience_mood_ratings")
      .withIndex("by_post", (q) => q.eq("experience_post_id", post._id))
      .collect();
    for (const row of ratings) {
      const bucket = moodBuckets.get(row.mood_id) ?? { ratings: [], verified: 0 };
      bucket.ratings.push(row.rating);
      if (isVerified) bucket.verified += 1;
      moodBuckets.set(row.mood_id, bucket);
    }
    const metrics = await ctx.db
      .query("experience_metrics")
      .withIndex("by_post", (q) => q.eq("experience_post_id", post._id))
      .unique();
    if (metrics?.worth_it != null) worth.push(metrics.worth_it);
    if (metrics?.spend_per_person != null) {
      spend.push(metrics.spend_per_person);
      if (isVerified) verifiedSpend += 1;
    }
    if (metrics?.crowd_level) {
      crowds.push(metrics.crowd_level);
      if (isVerified) verifiedCrowd += 1;
    }
    if (metrics?.visit_day_type) days.push(metrics.visit_day_type);
    if (metrics?.visit_time_period) {
      times.push(metrics.visit_time_period);
      if (isVerified) verifiedTime += 1;
    }
  }

  for (const [moodId, bucket] of moodBuckets) {
    const sampleCount = bucket.ratings.length;
    const avg = bucket.ratings.reduce((sum, n) => sum + n, 0) / sampleCount;
    const { confidence, tier } = confidenceFromSamples(sampleCount, bucket.verified);
    await ctx.db.insert("place_mood_stats", {
      place_id: placeId,
      mood_id: moodId as Id<"moods">,
      pair_key: pairKey(placeId, moodId),
      avg_rating: avg,
      smoothed_rating: bayesianAverage(avg, sampleCount, priorMean, priorN),
      sample_count: sampleCount,
      verified_sample_count: bucket.verified,
      confidence,
      tier,
      last_updated: now,
    });
  }

  const { confidence: expConf, tier: expTier } = confidenceFromSamples(
    visiblePosts.length,
    verifiedPosts,
  );
  const avgWorth = worth.length ? worth.reduce((sum, n) => sum + n, 0) / worth.length : undefined;
  await ctx.db.insert("place_experience_stats", {
    place_id: placeId,
    avg_worth_it: avgWorth,
    smoothed_worth_it:
      avgWorth !== undefined ? bayesianAverage(avgWorth, worth.length, priorMean, priorN) : undefined,
    sample_count: visiblePosts.length,
    verified_sample_count: verifiedPosts,
    verified_ratio: verifiedPosts / visiblePosts.length,
    confidence: expConf,
    tier: expTier,
    best_visit_context: deterministicMode(contexts, CONTEXT) ?? undefined,
    best_time_period: deterministicMode(times, TIMES) ?? undefined,
    last_updated: now,
  });

  if (crowds.length > 0) {
    const { confidence, tier } = confidenceFromSamples(crowds.length, verifiedCrowd);
    await ctx.db.insert("place_crowd_stats", {
      place_id: placeId,
      quiet_count: crowds.filter((c) => c === "quiet").length,
      normal_count: crowds.filter((c) => c === "normal").length,
      busy_count: crowds.filter((c) => c === "busy").length,
      very_busy_count: crowds.filter((c) => c === "very_busy").length,
      dominant_crowd: deterministicMode(crowds, CROWD) ?? undefined,
      sample_count: crowds.length,
      verified_sample_count: verifiedCrowd,
      confidence,
      tier,
      last_updated: now,
    });
  }

  if (spend.length > 0) {
    const { confidence, tier } = confidenceFromSamples(spend.length, verifiedSpend);
    await ctx.db.insert("place_cost_stats", {
      place_id: placeId,
      median_spend_per_person: deterministicMedian(spend) ?? undefined,
      avg_spend_per_person: spend.reduce((sum, n) => sum + n, 0) / spend.length,
      currency: "VND",
      sample_count: spend.length,
      verified_sample_count: verifiedSpend,
      confidence,
      tier,
      last_updated: now,
    });
  }

  const timeSamples = days.length + times.length;
  if (timeSamples > 0) {
    const { confidence, tier } = confidenceFromSamples(Math.max(days.length, times.length), verifiedTime);
    await ctx.db.insert("place_time_stats", {
      place_id: placeId,
      weekday_count: days.filter((d) => d === "weekday").length,
      weekend_count: days.filter((d) => d === "weekend").length,
      morning_count: times.filter((t) => t === "morning").length,
      afternoon_count: times.filter((t) => t === "afternoon").length,
      evening_count: times.filter((t) => t === "evening").length,
      night_count: times.filter((t) => t === "night").length,
      favorite_day_type: deterministicMode(days, DAYS) ?? undefined,
      favorite_time_period: deterministicMode(times, TIMES) ?? undefined,
      sample_count: Math.max(days.length, times.length),
      verified_sample_count: verifiedTime,
      confidence,
      tier,
      last_updated: now,
    });
  }
}
