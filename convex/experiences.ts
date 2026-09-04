import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requireResourceOwner, requireVerifiedProfile } from "./_lib/authz";
import { invariant } from "./_lib/errors";
import { pairKey } from "./_lib/uniqueness";
import { refreshPlaceAggregates } from "./_lib/placeAggregates";
import { isPublicPlace } from "./_lib/dtos";
import {
  crowdLevel,
  postType,
  visitContext,
  visitDayType,
  visitTimePeriod,
} from "./validators";

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const VIDEO_MIME = new Set(["video/mp4", "video/webm", "video/quicktime"]);

async function recordInline(
  ctx: MutationCtx,
  eventName: string,
  userId: Id<"profiles"> | undefined,
  properties: Record<string, string | number | boolean | null>,
) {
  await ctx.db.insert("product_events", {
    event_name: eventName,
    user_id: userId,
    properties,
    created_at: Date.now(),
  });
}

async function attachMedia(
  ctx: MutationCtx,
  postId: Id<"experience_posts">,
  storageIds: Id<"_storage">[],
) {
  invariant(storageIds.length <= 8, "VALIDATION_FAILED", "Too many media files");
  const seen = new Set<string>();
  for (const [index, storageId] of storageIds.entries()) {
    invariant(!seen.has(storageId), "VALIDATION_FAILED", "Duplicate media");
    seen.add(storageId);
    const existing = await ctx.db
      .query("post_media")
      .withIndex("by_storage", (q) => q.eq("storage_id", storageId))
      .unique();
    invariant(existing === null, "CONFLICT", "Media already attached");
    const meta = await ctx.db.system.get(storageId);
    invariant(meta !== null, "NOT_FOUND", "Upload not found");
    const mime = meta.contentType ?? "image/jpeg";
    const image = IMAGE_MIME.has(mime);
    const video = VIDEO_MIME.has(mime);
    invariant(image || video, "VALIDATION_FAILED", "Unsupported media type");
    const max = video ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
    invariant((meta.size ?? 0) <= max, "VALIDATION_FAILED", "File too large");
    await ctx.db.insert("post_media", {
      post_id: postId,
      storage_id: storageId,
      media_type: video ? "video" : "image",
      mime_type: mime,
      file_size_bytes: meta.size ?? 0,
      sort_order: index,
      processing_status: "ready",
      created_at: Date.now(),
    });
  }
}

const createArgs = {
  placeId: v.optional(v.id("places")),
  postType: v.optional(postType),
  caption: v.optional(v.string()),
  visitDate: v.optional(v.string()),
  visitContext: v.optional(visitContext),
  moodRatings: v.array(v.object({ moodId: v.id("moods"), rating: v.number() })),
  crowdLevel: v.optional(crowdLevel),
  worthIt: v.optional(v.number()),
  spendPerPerson: v.optional(v.number()),
  visitDayType: v.optional(visitDayType),
  visitTimePeriod: v.optional(visitTimePeriod),
  mediaStorageIds: v.optional(v.array(v.id("_storage"))),
  areaLabel: v.optional(v.string()),
  budgetMax: v.optional(v.number()),
  timeLabel: v.optional(v.string()),
  crowdPreference: v.optional(crowdLevel),
};

async function writePost(
  ctx: MutationCtx,
  args: {
    placeId?: Id<"places">;
    postType?: "experience" | "check_in" | "photo" | "video" | "community" | "question";
    caption?: string;
    visitDate?: string;
    visitContext?: "solo" | "couple" | "friends" | "family" | "work" | "other";
    moodRatings: Array<{ moodId: Id<"moods">; rating: number }>;
    crowdLevel?: "quiet" | "normal" | "busy" | "very_busy";
    worthIt?: number;
    spendPerPerson?: number;
    visitDayType?: "weekday" | "weekend" | "holiday";
    visitTimePeriod?: "morning" | "afternoon" | "evening" | "night";
    mediaStorageIds?: Id<"_storage">[];
    areaLabel?: string;
    budgetMax?: number;
    timeLabel?: string;
    crowdPreference?: "quiet" | "normal" | "busy" | "very_busy";
  },
  status: "draft" | "published",
) {
  const { profile } = await requireVerifiedProfile(ctx);
  invariant(args.moodRatings.length <= 5, "VALIDATION_FAILED", "Too many mood ratings");
  for (const row of args.moodRatings) {
    invariant(row.rating >= 1 && row.rating <= 5, "VALIDATION_FAILED", "Invalid mood rating");
    const mood = await ctx.db.get(row.moodId);
    invariant(mood !== null && mood.is_active, "VALIDATION_FAILED", "Unknown mood");
  }
  if (args.placeId) {
    const place = await ctx.db.get(args.placeId);
    invariant(place !== null && isPublicPlace(place), "NOT_FOUND", "Place not found");
  }
  if (args.caption !== undefined) {
    invariant(args.caption.length <= 2000, "VALIDATION_FAILED", "Caption too long");
  }
  const now = Date.now();
  const kind = args.postType ?? "experience";
  const postId = await ctx.db.insert("experience_posts", {
    author_id: profile._id,
    place_id: args.placeId,
    caption: args.caption,
    status,
    post_type: kind,
    visibility: "public",
    visit_date: args.visitDate,
    visit_context: args.visitContext,
    verification_status: "unverified",
    moderation_status: "approved",
    area_label: args.areaLabel,
    like_count: 0,
    comment_count: 0,
    share_count: 0,
    save_count: 0,
    published_at: status === "published" ? now : undefined,
    created_at: now,
    updated_at: now,
  });

  await attachMedia(ctx, postId, args.mediaStorageIds ?? []);

  for (const row of args.moodRatings) {
    await ctx.db.insert("experience_mood_ratings", {
      experience_post_id: postId,
      mood_id: row.moodId,
      pair_key: pairKey(postId, row.moodId),
      rating: row.rating,
      created_at: now,
    });
  }

  if (
    args.crowdLevel !== undefined ||
    args.worthIt !== undefined ||
    args.spendPerPerson !== undefined ||
    args.visitDayType !== undefined ||
    args.visitTimePeriod !== undefined
  ) {
    await ctx.db.insert("experience_metrics", {
      experience_post_id: postId,
      crowd_level: args.crowdLevel,
      worth_it: args.worthIt,
      spend_per_person: args.spendPerPerson,
      currency: "VND",
      visit_day_type: args.visitDayType,
      visit_time_period: args.visitTimePeriod,
      created_at: now,
      updated_at: now,
    });
  }

  if (kind === "question") {
    await ctx.db.insert("community_question_meta", {
      post_id: postId,
      area_label: args.areaLabel,
      budget_max: args.budgetMax,
      mood_id: args.moodRatings[0]?.moodId,
      visit_context: args.visitContext,
      time_label: args.timeLabel,
      crowd_preference: args.crowdPreference,
      created_at: now,
    });
  }

  if (status === "published") {
    if (args.placeId) await refreshPlaceAggregates(ctx, args.placeId);
    await recordInline(ctx, "experience_published", profile._id, {
      place_id: args.placeId ?? null,
      post_id: postId,
    });
    await recordInline(ctx, "post_created", profile._id, {
      post_id: postId,
      author_id: profile._id,
      post_type: kind,
    });
    if (kind === "question" || kind === "community") {
      await recordInline(ctx, "community_question_created", profile._id, {
        post_id: postId,
        kind,
      });
    }
    if (kind === "check_in") {
      await recordInline(ctx, "checkin_created", profile._id, {
        post_id: postId,
        place_id: args.placeId ?? null,
      });
    }
  }

  return { id: postId };
}

export const create = mutation({
  args: createArgs,
  handler: async (ctx, args) => writePost(ctx, args, "published"),
});

export const saveDraft = mutation({
  args: createArgs,
  handler: async (ctx, args) => writePost(ctx, args, "draft"),
});

export const softDelete = mutation({
  args: { postId: v.id("experience_posts") },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const post = await ctx.db.get(args.postId);
    invariant(post !== null, "NOT_FOUND", "Post not found");
    requireResourceOwner({ authUserId: profile.auth_user_id, profile }, post.author_id);
    await ctx.db.patch(post._id, {
      status: "deleted",
      deleted_at: Date.now(),
      updated_at: Date.now(),
    });
    if (post.place_id) await refreshPlaceAggregates(ctx, post.place_id);
    return { ok: true as const };
  },
});
