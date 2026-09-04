import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { optionalIdentity } from "./_lib/authz";

const COORD_KEY = /lat|lng|lon|coord|gps|accuracy/i;

function scrub(
  properties: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(properties).filter(([key]) => !COORD_KEY.test(key)),
  );
}

export const recordEvent = mutation({
  args: {
    eventName: v.string(),
    sessionId: v.optional(v.string()),
    properties: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean(), v.null()))),
  },
  handler: async (ctx, args) => {
    const identity = await optionalIdentity(ctx);
    const properties = scrub(args.properties ?? {});
    await ctx.db.insert("product_events", {
      event_name: args.eventName,
      user_id: identity?.profile._id,
      session_id: args.sessionId,
      properties,
      created_at: Date.now(),
    });
    if (identity) {
      const entityId =
        (typeof properties.place_id === "string" && properties.place_id) ||
        (typeof properties.post_id === "string" && properties.post_id) ||
        (typeof properties.mood_id === "string" && properties.mood_id) ||
        (typeof properties.target_user_id === "string" && properties.target_user_id) ||
        (typeof properties.profile_id === "string" && properties.profile_id) ||
        undefined;
      const entityType =
        typeof properties.place_id === "string"
          ? "place"
          : typeof properties.mood_id === "string"
            ? "mood"
            : typeof properties.target_user_id === "string" || typeof properties.profile_id === "string"
              ? "author"
              : typeof properties.post_id === "string"
                ? "post"
                : undefined;
      if (entityType && entityId) {
        await ctx.db.insert("user_interest_signals", {
          user_id: identity.profile._id,
          entity_type: entityType,
          entity_id: entityId,
          signal_type: args.eventName,
          weight: 1,
          created_at: Date.now(),
        });
      }
    }
    return { ok: true as const };
  },
});

export const taste = query({
  args: {},
  handler: async (ctx) => {
    const identity = await optionalIdentity(ctx);
    const places: Record<string, number> = {};
    const moods: Record<string, number> = {};
    const authors: Record<string, number> = {};
    if (identity === null) return { places, moods, authors };
    const since = Date.now() - 45 * 24 * 3600_000;
    const rows = await ctx.db
      .query("user_interest_signals")
      .withIndex("by_user_created", (q) => q.eq("user_id", identity.profile._id))
      .take(400);
    for (const row of rows) {
      if (row.created_at < since || !row.entity_id) continue;
      const target =
        row.entity_type === "place" ? places : row.entity_type === "mood" ? moods : row.entity_type === "author" ? authors : null;
      if (target === null) continue;
      target[row.entity_id] = (target[row.entity_id] ?? 0) + row.weight;
    }
    return { places, moods, authors };
  },
});
