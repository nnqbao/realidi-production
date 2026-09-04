import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireIdentity } from "./_lib/authz";

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const { profile } = await requireIdentity(ctx);
    const row = await ctx.db.get(args.id);
    if (row === null || row.user_id !== profile._id) return { ok: false as const };
    if (row.read_at === undefined) await ctx.db.patch(row._id, { read_at: Date.now() });
    return { ok: true as const };
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireIdentity(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_read_created", (q) => q.eq("user_id", profile._id as Id<"profiles">))
      .take(80);
    const now = Date.now();
    for (const row of rows) {
      if (row.read_at === undefined) await ctx.db.patch(row._id, { read_at: now });
    }
    return { ok: true as const };
  },
});
