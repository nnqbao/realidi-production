import { v } from "convex/values";
import { query } from "./_generated/server";
import { optionalIdentity } from "./_lib/authz";
import { toPlace } from "./_lib/dtos";
import { canSeePost, hydratePosts, loadViewerSets } from "./_lib/feedDto";
import { normalizeSearchText } from "./_lib/search";

export const places = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const needle = normalizeSearchText(args.query);
    if (!needle) return [];
    const collected = [];
    for (const city of ["TP. Hồ Chí Minh", "Ho Chi Minh City"] as const) {
      const rows = await ctx.db
        .query("places")
        .withIndex("by_city_status", (q) => q.eq("city", city).eq("status", "active"))
        .take(80);
      collected.push(...rows);
    }
    return collected
      .filter((place) => place.deleted_at === undefined && place.normalized_search.includes(needle))
      .slice(0, 30)
      .map(toPlace);
  },
});

export const people = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const needle = normalizeSearchText(args.query);
    if (!needle) return [];
    const identity = await optionalIdentity(ctx);
    const blocked = new Set<string>();
    if (identity) {
      const outgoing = await ctx.db
        .query("user_blocks")
        .withIndex("by_blocker", (q) => q.eq("blocker_id", identity.profile._id))
        .collect();
      const incoming = await ctx.db
        .query("user_blocks")
        .withIndex("by_blocked", (q) => q.eq("blocked_id", identity.profile._id))
        .collect();
      for (const row of outgoing) blocked.add(row.blocked_id);
      for (const row of incoming) blocked.add(row.blocker_id);
    }
    const profiles = await ctx.db.query("profiles").collect();
    return profiles
      .filter((profile) =>
        profile.deleted_at === undefined &&
        profile.banned_at === undefined &&
        profile.role !== "admin" &&
        profile.role !== "moderator" &&
        profile.role !== "owner" &&
        profile.username !== "realidi" &&
        !blocked.has(profile._id) &&
        normalizeSearchText(`${profile.username} ${profile.display_name}`).includes(needle))
      .slice(0, 12)
      .map((profile) => ({
        id: profile._id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_path: null as string | null,
        bio: profile.bio ?? null,
      }));
  },
});

export const posts = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const needle = normalizeSearchText(args.query);
    if (!needle) return [];
    const viewer = await loadViewerSets(ctx);
    const rows = await ctx.db
      .query("experience_posts")
      .withIndex("by_feed", (q) => q.eq("status", "published").eq("visibility", "public"))
      .take(80);
    const matched = [];
    for (const post of rows) {
      if (!post.caption || !normalizeSearchText(post.caption).includes(needle)) continue;
      const author = await ctx.db.get(post.author_id);
      if (!canSeePost(post, author, viewer)) continue;
      matched.push(post);
      if (matched.length >= 12) break;
    }
    return await hydratePosts(ctx, matched, viewer);
  },
});
