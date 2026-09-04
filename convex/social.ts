import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { optionalIdentity, requireVerifiedProfile } from "./_lib/authz";
import { assertCounter } from "./_lib/aggregates";
import { invariant } from "./_lib/errors";
import { notifyEvent } from "./_lib/notify";
import { pairKey } from "./_lib/uniqueness";
import { reportTargetType } from "./validators";

async function bump(
  ctx: MutationCtx,
  postId: Id<"experience_posts">,
  field: "like_count" | "comment_count" | "share_count" | "save_count",
  delta: number,
) {
  const post = await ctx.db.get(postId);
  invariant(post !== null, "NOT_FOUND", "Post not found");
  await ctx.db.patch(postId, { [field]: assertCounter(post[field] + delta) });
}

export const toggleBeenThere = mutation({
  args: { placeId: v.id("places") },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const place = await ctx.db.get(args.placeId);
    invariant(place !== null, "NOT_FOUND", "Place not found");
    const key = pairKey(profile._id, args.placeId);
    const existing = await ctx.db
      .query("visit_claims")
      .withIndex("by_pair", (q) => q.eq("pair_key", key))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { beenThere: false as const };
    }
    await ctx.db.insert("visit_claims", {
      user_id: profile._id,
      place_id: args.placeId,
      pair_key: key,
      claimed_at: Date.now(),
    });
    return { beenThere: true as const };
  },
});

export const toggleFollow = mutation({
  args: { userId: v.id("profiles") },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    if (profile._id === args.userId) return { following: false as const };
    const target = await ctx.db.get(args.userId);
    invariant(target !== null && target.deleted_at === undefined, "NOT_FOUND", "User not found");
    const key = pairKey(profile._id, args.userId);
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_pair", (q) => q.eq("pair_key", key))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { following: false as const };
    }
    await ctx.db.insert("follows", {
      follower_id: profile._id,
      following_id: args.userId,
      pair_key: key,
      created_at: Date.now(),
    });
    await notifyEvent(ctx, { recipientId: args.userId, type: "new_follower" });
    return { following: true as const };
  },
});

export const toggleLike = mutation({
  args: { postId: v.id("experience_posts") },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const post = await ctx.db.get(args.postId);
    invariant(post !== null, "NOT_FOUND", "Post not found");
    const key = pairKey(profile._id, args.postId);
    const existing = await ctx.db
      .query("post_likes")
      .withIndex("by_pair", (q) => q.eq("pair_key", key))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      await bump(ctx, args.postId, "like_count", -1);
      return { liked: false as const };
    }
    await ctx.db.insert("post_likes", {
      user_id: profile._id,
      post_id: args.postId,
      pair_key: key,
      created_at: Date.now(),
    });
    await bump(ctx, args.postId, "like_count", 1);
    await notifyEvent(ctx, {
      recipientId: post.author_id,
      type: "post_like",
      postId: args.postId,
    });
    return { liked: true as const };
  },
});

export const toggleSavePost = mutation({
  args: { postId: v.id("experience_posts") },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const post = await ctx.db.get(args.postId);
    invariant(post !== null, "NOT_FOUND", "Post not found");
    const key = pairKey(profile._id, args.postId);
    const existing = await ctx.db
      .query("saved_posts")
      .withIndex("by_pair", (q) => q.eq("pair_key", key))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      await bump(ctx, args.postId, "save_count", -1);
      return { saved: false as const };
    }
    await ctx.db.insert("saved_posts", {
      user_id: profile._id,
      post_id: args.postId,
      pair_key: key,
      created_at: Date.now(),
    });
    await bump(ctx, args.postId, "save_count", 1);
    await notifyEvent(ctx, {
      recipientId: post.author_id,
      type: "post_saved",
      postId: args.postId,
    });
    return { saved: true as const };
  },
});

export const addComment = mutation({
  args: {
    postId: v.id("experience_posts"),
    body: v.string(),
    parentId: v.optional(v.id("comments")),
    placeId: v.optional(v.id("places")),
    attachedPostId: v.optional(v.id("experience_posts")),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const trimmed = args.body.trim();
    invariant(trimmed.length >= 1 && trimmed.length <= 2000, "VALIDATION_FAILED", "Invalid comment");
    const post = await ctx.db.get(args.postId);
    invariant(post !== null, "NOT_FOUND", "Post not found");
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      invariant(parent !== null && parent.post_id === args.postId, "NOT_FOUND", "Parent comment not found");
    }
    const now = Date.now();
    const commentId = await ctx.db.insert("comments", {
      post_id: args.postId,
      author_id: profile._id,
      body: trimmed,
      parent_id: args.parentId,
      place_id: args.placeId,
      attached_post_id: args.attachedPostId,
      moderation_status: "approved",
      created_at: now,
      updated_at: now,
    });
    await bump(ctx, args.postId, "comment_count", 1);
    const type = args.parentId
      ? "comment_reply"
      : post.post_type === "question"
        ? "community_answer"
        : "post_comment";
    await notifyEvent(ctx, {
      recipientId: post.author_id,
      type,
      postId: args.postId,
      commentId,
    });
    return { id: commentId, postId: args.postId, body: trimmed, authorId: profile._id };
  },
});

export const deleteComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const comment = await ctx.db.get(args.commentId);
    invariant(comment !== null, "NOT_FOUND", "Comment not found");
    invariant(comment.author_id === profile._id, "FORBIDDEN", "Not your comment");
    if (comment.deleted_at !== undefined) return { ok: true as const };
    await ctx.db.patch(comment._id, { deleted_at: Date.now(), updated_at: Date.now() });
    await bump(ctx, comment.post_id, "comment_count", -1);
    return { ok: true as const };
  },
});

export const recordShare = mutation({
  args: {
    placeId: v.optional(v.id("places")),
    postId: v.optional(v.id("experience_posts")),
    channel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await optionalIdentity(ctx);
    await ctx.db.insert("shares", {
      user_id: identity?.profile._id,
      place_id: args.placeId,
      post_id: args.postId,
      channel: args.channel ?? "link",
      created_at: Date.now(),
    });
    if (args.postId) {
      const post = await ctx.db.get(args.postId);
      if (post) await ctx.db.patch(args.postId, { share_count: assertCounter(post.share_count + 1) });
    }
    return { ok: true as const };
  },
});

export const submitReport = mutation({
  args: {
    targetType: reportTargetType,
    targetId: v.string(),
    reason: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const since = Date.now() - 24 * 60 * 60_000;
    const recent = await ctx.db
      .query("reports")
      .withIndex("by_reporter_target", (q) =>
        q.eq("reporter_id", profile._id).eq("target_type", args.targetType).eq("target_id", args.targetId))
      .order("desc")
      .take(8);
    if (recent.some((row) => row.created_at >= since)) return { duplicate: true as const };
    const now = Date.now();
    await ctx.db.insert("reports", {
      reporter_id: profile._id,
      target_type: args.targetType,
      target_id: args.targetId,
      reason: args.reason,
      details: args.details,
      status: "pending",
      priority: args.reason === "hate" || args.reason === "harassment" ? "high" : "normal",
      created_at: now,
      updated_at: now,
    });
    return { duplicate: false as const };
  },
});

export const hidePost = mutation({
  args: { postId: v.id("experience_posts") },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const post = await ctx.db.get(args.postId);
    invariant(post !== null, "NOT_FOUND", "Post not found");
    const key = pairKey(profile._id, args.postId);
    const existing = await ctx.db
      .query("user_hidden_posts")
      .withIndex("by_pair", (q) => q.eq("pair_key", key))
      .unique();
    if (existing) return { ok: true as const };
    await ctx.db.insert("user_hidden_posts", {
      user_id: profile._id,
      post_id: args.postId,
      pair_key: key,
      created_at: Date.now(),
    });
    return { ok: true as const };
  },
});

export const unhidePost = mutation({
  args: { postId: v.id("experience_posts") },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const key = pairKey(profile._id, args.postId);
    const existing = await ctx.db
      .query("user_hidden_posts")
      .withIndex("by_pair", (q) => q.eq("pair_key", key))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return { ok: true as const };
  },
});

export const hiddenIds = query({
  args: {},
  handler: async (ctx) => {
    const identity = await optionalIdentity(ctx);
    if (identity === null) return [] as string[];
    const rows = await ctx.db
      .query("user_hidden_posts")
      .withIndex("by_user", (q) => q.eq("user_id", identity.profile._id))
      .collect();
    return rows.map((row) => row.post_id as string);
  },
});

export const blockedIds = query({
  args: {},
  handler: async (ctx) => {
    const identity = await optionalIdentity(ctx);
    if (identity === null) return [] as string[];
    const outgoing = await ctx.db
      .query("user_blocks")
      .withIndex("by_blocker", (q) => q.eq("blocker_id", identity.profile._id))
      .collect();
    const incoming = await ctx.db
      .query("user_blocks")
      .withIndex("by_blocked", (q) => q.eq("blocked_id", identity.profile._id))
      .collect();
    return [
      ...outgoing.map((row) => row.blocked_id as string),
      ...incoming.map((row) => row.blocker_id as string),
    ];
  },
});
