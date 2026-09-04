import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { optionalIdentity, requireIdentity } from "./_lib/authz";
import { areBlocked } from "./_lib/blocks";
import { iso } from "./_lib/dtos";

const HEARTBEAT_MIN_MS = 20_000;
const ONLINE_MS = 90_000;
const IDLE_MS = 5 * 60_000;

function statusOf(lastActiveAt: number | undefined, show: boolean, now: number) {
  if (!show) return "hidden" as const;
  if (lastActiveAt === undefined) return "unknown" as const;
  if (now - lastActiveAt <= ONLINE_MS) return "online" as const;
  if (now - lastActiveAt <= IDLE_MS) return "idle" as const;
  return "offline" as const;
}

export const heartbeat = mutation({
  args: { idle: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const { profile } = await requireIdentity(ctx);
    const now = Date.now();
    const full = await ctx.db.get(profile._id);
    if (
      full?.last_active_at !== undefined &&
      now - full.last_active_at < HEARTBEAT_MIN_MS &&
      args.idle !== true
    ) {
      return { ok: true as const };
    }
    await ctx.db.patch(profile._id, {
      last_seen_at: now,
      last_active_at: args.idle ? full?.last_active_at ?? now : now,
      updated_at: now,
    });
    return { ok: true as const };
  },
});

export const snapshot = query({
  args: { userIds: v.array(v.id("profiles")) },
  handler: async (ctx, args) => {
    const identity = await optionalIdentity(ctx);
    const now = Date.now();
    const out: Array<{
      userId: string;
      status: "online" | "idle" | "offline" | "unknown" | "hidden";
      lastActiveAt: string | null;
    }> = [];
    for (const userId of args.userIds.slice(0, 40)) {
      const person = await ctx.db.get(userId);
      if (person === null) {
        out.push({ userId, status: "unknown", lastActiveAt: null });
        continue;
      }
      const blocked =
        identity !== null ? await areBlocked(ctx, identity.profile._id, userId) : false;
      if (blocked || !person.show_activity_status) {
        out.push({ userId, status: "hidden", lastActiveAt: null });
        continue;
      }
      out.push({
        userId,
        status: statusOf(person.last_active_at, true, now),
        lastActiveAt: iso(person.last_active_at),
      });
    }
    return out;
  },
});

export const cleanupTyping = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("conversation_typing")
      .withIndex("by_expiry", (q) => q.lte("expires_at", now))
      .take(80);
    let deleted = 0;
    for (const row of rows) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    return { deleted };
  },
});
