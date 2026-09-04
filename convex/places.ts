import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { optionalIdentity, requireVerifiedProfile } from "./_lib/authz";
import {
  HCMC_CITIES,
  PLACE_CANDIDATE_CEILING,
  isDiscoverablePlace,
  isPublicPlace,
  toCategory,
  toMood,
  toPlace,
} from "./_lib/dtos";
import { invariant } from "./_lib/errors";
import { pairKey } from "./_lib/uniqueness";
import { normalizeSearchText } from "./_lib/search";

export const bySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const place = await ctx.db
      .query("places")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (place === null) return null;

    if (place.status === "merged" && place.merged_into_place_id) {
      const canonical = await ctx.db.get(place.merged_into_place_id);
      return {
        place: toPlace(place),
        category: place.category_id ? toCategory((await ctx.db.get(place.category_id))!) : null,
        mergedIntoSlug: canonical?.slug ?? null,
        moodProfile: [],
        experienceStats: null,
        crowd: null,
        cost: null,
        timeStats: null,
        posts: [],
        saved: false,
        beenThere: false,
      };
    }

    if (!isPublicPlace(place) && place.status !== "merged") return null;

    const identity = await optionalIdentity(ctx);
    const category = place.category_id ? await ctx.db.get(place.category_id) : null;
    const moodStats = await ctx.db
      .query("place_mood_stats")
      .withIndex("by_place", (q) => q.eq("place_id", place._id))
      .collect();
    const moods = await ctx.db
      .query("moods")
      .withIndex("by_active_order", (q) => q.eq("is_active", true))
      .collect();
    const moodById = new Map(moods.map((m) => [m._id, m]));
    const exp = await ctx.db
      .query("place_experience_stats")
      .withIndex("by_place", (q) => q.eq("place_id", place._id))
      .unique();
    const crowd = await ctx.db
      .query("place_crowd_stats")
      .withIndex("by_place", (q) => q.eq("place_id", place._id))
      .unique();
    const cost = await ctx.db
      .query("place_cost_stats")
      .withIndex("by_place", (q) => q.eq("place_id", place._id))
      .unique();
    const timeStats = await ctx.db
      .query("place_time_stats")
      .withIndex("by_place", (q) => q.eq("place_id", place._id))
      .unique();

    const posts = await ctx.db
      .query("experience_posts")
      .withIndex("by_place_published", (q) => q.eq("place_id", place._id))
      .order("desc")
      .take(20);

    const postCards = [];
    for (const post of posts) {
      if (post.status !== "published" || post.deleted_at !== undefined) continue;
      if (post.moderation_status === "hidden") continue;
      if (post.visibility !== "public") continue;
      const author = await ctx.db.get(post.author_id);
      if (!author || author.deleted_at !== undefined || author.banned_at !== undefined) continue;
      const media = await ctx.db
        .query("post_media")
        .withIndex("by_post_order", (q) => q.eq("post_id", post._id))
        .first();
      postCards.push({
        id: post._id,
        caption: post.caption ?? null,
        verificationStatus: post.verification_status,
        likeCount: post.like_count,
        commentCount: post.comment_count,
        createdAt: new Date(post.created_at).toISOString(),
        visitContext: post.visit_context ?? null,
        author: author
          ? {
              id: author._id,
              username: author.username,
              display_name: author.display_name,
              bio: author.bio ?? null,
              avatar_path: null,
              role: author.role,
              locale: author.locale,
              timezone: author.timezone,
              home_city: author.home_city ?? null,
              onboarding_completed_at: null,
              onboarding_skipped_at: null,
              last_seen_at: null,
              last_active_at: null,
              show_activity_status: author.show_activity_status,
              created_at: new Date(author.created_at).toISOString(),
              updated_at: new Date(author.created_at).toISOString(),
              deleted_at: null,
              suspended_at: null,
              banned_at: null,
              ban_reason: null,
              suspension_ends_at: null,
              deletion_requested_at: null,
              warned_at: null,
            }
          : null,
        mediaPath: media ? await ctx.storage.getUrl(media.storage_id) : null,
      });
    }

    let saved = false;
    let beenThere = false;
    if (identity) {
      const save = await ctx.db
        .query("saves")
        .withIndex("by_unique_key", (q) =>
          q.eq("unique_key", pairKey(identity.profile._id, place._id)))
        .unique();
      saved = save !== null;
      const claim = await ctx.db
        .query("visit_claims")
        .withIndex("by_pair", (q) =>
          q.eq("pair_key", pairKey(identity.profile._id, place._id)))
        .unique();
      beenThere = claim !== null;
    }

    return {
      place: toPlace(place),
      category: category ? toCategory(category) : null,
      mergedIntoSlug: null,
      moodProfile: moodStats
        .flatMap((stat) => {
          const mood = moodById.get(stat.mood_id);
          if (!mood) return [];
          return [{
            mood: toMood(mood),
            avg: stat.avg_rating ?? null,
            samples: stat.sample_count,
            verifiedSamples: stat.verified_sample_count,
            tier: stat.tier,
          }];
        })
        .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0)),
      experienceStats: exp
        ? {
            sampleCount: exp.sample_count,
            verifiedCount: exp.verified_sample_count,
            verifiedRatio: exp.verified_ratio,
            worthIt: exp.avg_worth_it ?? null,
            bestContext: exp.best_visit_context ?? null,
            bestTime: exp.best_time_period ?? null,
            tier: exp.tier,
          }
        : null,
      crowd: crowd
        ? { dominant: crowd.dominant_crowd ?? null, sampleCount: crowd.sample_count, tier: crowd.tier }
        : null,
      cost: cost
        ? {
            median: cost.median_spend_per_person ?? null,
            sampleCount: cost.sample_count,
            tier: cost.tier,
            currency: cost.currency,
          }
        : null,
      timeStats: timeStats
        ? {
            sampleCount: timeStats.sample_count,
            verifiedSampleCount: timeStats.verified_sample_count,
            weekdayCount: timeStats.weekday_count,
            weekendCount: timeStats.weekend_count,
            morningCount: timeStats.morning_count,
            afternoonCount: timeStats.afternoon_count,
            eveningCount: timeStats.evening_count,
            nightCount: timeStats.night_count,
            favoriteDayType: timeStats.favorite_day_type ?? null,
            favoriteTimePeriod: timeStats.favorite_time_period ?? null,
            tier: timeStats.tier,
          }
        : null,
      posts: postCards,
      saved,
      beenThere,
    };
  },
});

export const mapPins = query({
  args: {
    moodId: v.optional(v.string()),
    categoryId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
    let allowed: Set<string> | null = null;
    if (args.moodId) {
      const links = await ctx.db
        .query("place_moods")
        .withIndex("by_mood", (q) => q.eq("mood_id", args.moodId as Id<"moods">))
        .collect();
      allowed = new Set(links.map((link) => link.place_id));
    }
    return collected
      .filter((place) => isDiscoverablePlace(place) && place.latitude_e6 !== undefined)
      .filter((place) => !args.categoryId || place.category_id === args.categoryId)
      .filter((place) => !allowed || allowed.has(place._id))
      .sort((a, b) => b.editorial_score - a.editorial_score)
      .slice(0, 40)
      .map((place) => ({
        id: place._id,
        slug: place.slug,
        name: place.name,
        district: place.district ?? null,
        latitude: place.latitude_e6! / 1_000_000,
        longitude: place.longitude_e6! / 1_000_000,
        cover_image_path: place.cover_image_path ?? null,
      }));
  },
});

export const lite = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("places")
      .withIndex("by_city_status", (q) =>
        q.eq("city", "TP. Hồ Chí Minh").eq("status", "active"))
      .take(PLACE_CANDIDATE_CEILING);
    return rows
      .filter(isDiscoverablePlace)
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))
      .map((place) => ({
        id: place._id,
        name: place.name,
        district: place.district ?? null,
      }));
  },
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const needle = normalizeSearchText(args.query);
    if (!needle) return [];
    const collected = [];
    for (const city of HCMC_CITIES) {
      const rows = await ctx.db
        .query("places")
        .withIndex("by_city_status", (q) => q.eq("city", city).eq("status", "active"))
        .take(PLACE_CANDIDATE_CEILING);
      collected.push(...rows);
    }
    return collected
      .filter((place) => isDiscoverablePlace(place) && place.normalized_search.includes(needle))
      .slice(0, 30)
      .map(toPlace);
  },
});

export const saved = query({
  args: {},
  handler: async (ctx) => {
    const identity = await optionalIdentity(ctx);
    if (identity === null) return [];
    const rows = await ctx.db
      .query("saves")
      .withIndex("by_user_created", (q) => q.eq("user_id", identity.profile._id))
      .order("desc")
      .take(80);
    const out = [];
    for (const row of rows) {
      const place = await ctx.db.get(row.place_id);
      if (!place || !isPublicPlace(place)) continue;
      const category = place.category_id ? await ctx.db.get(place.category_id) : null;
      out.push({
        created_at: new Date(row.created_at).toISOString(),
        places: {
          ...toPlace(place),
          place_categories: category ? toCategory(category) : null,
        },
      });
    }
    return out;
  },
});

export const toggleSave = mutation({
  args: {
    placeId: v.id("places"),
    intent: v.optional(v.union(v.literal("saved"), v.literal("want_to_go"))),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const place = await ctx.db.get(args.placeId);
    invariant(place !== null && isPublicPlace(place), "NOT_FOUND", "Place not found");
    const intent = args.intent ?? "saved";
    const unique = pairKey(profile._id, args.placeId);
    const existing = await ctx.db
      .query("saves")
      .withIndex("by_unique_key", (q) => q.eq("unique_key", unique))
      .unique();
    if (existing) {
      if (existing.intent === intent) {
        await ctx.db.delete(existing._id);
        return { saved: false as const, intent: null };
      }
      await ctx.db.patch(existing._id, { intent });
      return { saved: true as const, intent };
    }
    const collection = await ctx.db
      .query("saved_collections")
      .withIndex("by_user", (q) => q.eq("user_id", profile._id))
      .collect()
      .then((rows) => rows.find((row) => row.is_default) ?? null);
    await ctx.db.insert("saves", {
      user_id: profile._id,
      place_id: args.placeId,
      collection_id: collection?._id,
      unique_key: unique,
      intent,
      created_at: Date.now(),
    });
    return { saved: true as const, intent };
  },
});
