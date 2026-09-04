import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { optionalIdentity, requireVerifiedProfile } from "./_lib/authz";
import { invariant } from "./_lib/errors";
import { pairKey } from "./_lib/uniqueness";

export const block = mutation({
  args: { userId: v.id("profiles") },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    invariant(profile._id !== args.userId, "VALIDATION_FAILED", "NO_SELF");
    const other = await ctx.db.get(args.userId);
    invariant(other !== null, "NOT_FOUND", "User not found");
    const key = pairKey(profile._id, args.userId);
    const existing = await ctx.db
      .query("user_blocks")
      .withIndex("by_pair", (q) => q.eq("pair_key", key))
      .unique();
    if (existing) return { blocked: true as const };
    await ctx.db.insert("user_blocks", {
      blocker_id: profile._id,
      blocked_id: args.userId,
      pair_key: key,
      created_at: Date.now(),
    });
    return { blocked: true as const };
  },
});

export const unblock = mutation({
  args: { userId: v.id("profiles") },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const existing = await ctx.db
      .query("user_blocks")
      .withIndex("by_pair", (q) => q.eq("pair_key", pairKey(profile._id, args.userId)))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return { blocked: false as const };
  },
});

export const blockedWith = query({
  args: { userId: v.id("profiles") },
  handler: async (ctx, args) => {
    const identity = await optionalIdentity(ctx);
    if (identity === null) return { blockedByMe: false, blocked: false };
    const outgoing = await ctx.db
      .query("user_blocks")
      .withIndex("by_pair", (q) => q.eq("pair_key", pairKey(identity.profile._id, args.userId)))
      .unique();
    const incoming = await ctx.db
      .query("user_blocks")
      .withIndex("by_pair", (q) => q.eq("pair_key", pairKey(args.userId, identity.profile._id)))
      .unique();
    return {
      blockedByMe: outgoing !== null,
      blocked: outgoing !== null || incoming !== null,
    };
  },
});
