import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireVerifiedProfile } from "./_lib/authz";
import { invariant } from "./_lib/errors";

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const VIDEO_MIME = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;
const MAX_AVATAR = 5 * 1024 * 1024;
const MAX_PLACE = 10 * 1024 * 1024;

export const generateUploadUrl = mutation({
  args: {
    purpose: v.union(
      v.literal("experience"),
      v.literal("avatar"),
      v.literal("place"),
      v.literal("message"),
    ),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    if (args.purpose === "place") {
      invariant(
        profile.role === "editor" || profile.role === "admin" || profile.role === "owner",
        "FORBIDDEN",
        "Place media requires a place manager",
      );
    }
    return await ctx.storage.generateUploadUrl();
  },
});

function limits(purpose: "experience" | "avatar" | "place" | "message", mime: string) {
  const image = IMAGE_MIME.has(mime);
  const video = VIDEO_MIME.has(mime);
  if (purpose === "avatar") {
    invariant(image, "VALIDATION_FAILED", "Avatar must be an image");
    return MAX_AVATAR;
  }
  if (purpose === "place" || purpose === "message") {
    invariant(image, "VALIDATION_FAILED", purpose === "message" ? "Message media must be an image" : "Place media must be an image");
    return purpose === "message" ? MAX_IMAGE : MAX_PLACE;
  }
  invariant(image || video, "VALIDATION_FAILED", "Unsupported media type");
  return video ? MAX_VIDEO : MAX_IMAGE;
}

export const finalize = mutation({
  args: {
    storageId: v.id("_storage"),
    purpose: v.union(
      v.literal("experience"),
      v.literal("avatar"),
      v.literal("place"),
      v.literal("message"),
    ),
    mimeType: v.string(),
    byteSize: v.number(),
  },
  handler: async (ctx, args) => {
    await requireVerifiedProfile(ctx);
    const meta = await ctx.db.system.get(args.storageId);
    invariant(meta !== null, "NOT_FOUND", "Upload not found");
    const mime = meta.contentType ?? args.mimeType;
    const size = meta.size ?? args.byteSize;
    const max = limits(args.purpose, mime);
    invariant(size <= max, "VALIDATION_FAILED", "File too large");
    return {
      storageId: args.storageId,
      mimeType: mime,
      fileSizeBytes: size,
      mediaType: VIDEO_MIME.has(mime) ? ("video" as const) : ("image" as const),
      processingStatus: "ready" as const,
    };
  },
});

export const remove = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const attached = await ctx.db
      .query("post_media")
      .withIndex("by_storage", (q) => q.eq("storage_id", args.storageId))
      .unique();
    if (attached) {
      const post = await ctx.db.get(attached.post_id);
      invariant(post !== null && post.author_id === profile._id, "FORBIDDEN", "Not your media");
      await ctx.db.delete(attached._id);
    }
    const placeMedia = await ctx.db
      .query("place_media")
      .withIndex("by_storage", (q) => q.eq("storage_id", args.storageId))
      .unique();
    invariant(placeMedia === null, "FORBIDDEN", "Place media requires a manager");
    const fullProfile = await ctx.db.get(profile._id);
    if (fullProfile?.avatar_storage_id === args.storageId) {
      await ctx.db.patch(profile._id, { avatar_storage_id: undefined, updated_at: Date.now() });
    }
    await ctx.storage.delete(args.storageId);
    return { ok: true as const };
  },
});

export const cleanupOrphans = internalMutation({
  args: { olderThanMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - (args.olderThanMs ?? 60 * 60_000);
    const objects = await ctx.db.system.query("_storage").collect();
    const referenced = new Set<string>();
    for (const row of await ctx.db.query("post_media").collect()) {
      referenced.add(row.storage_id);
      if (row.thumbnail_storage_id) referenced.add(row.thumbnail_storage_id);
    }
    for (const row of await ctx.db.query("place_media").collect()) referenced.add(row.storage_id);
    for (const row of await ctx.db.query("profiles").collect()) {
      if (row.avatar_storage_id) referenced.add(row.avatar_storage_id);
    }
    let deleted = 0;
    for (const object of objects) {
      if (referenced.has(object._id)) continue;
      if (object._creationTime > cutoff) continue;
      await ctx.storage.delete(object._id as Id<"_storage">);
      deleted += 1;
    }
    return { deleted };
  },
});
