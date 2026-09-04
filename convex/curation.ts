import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { isPublicPlace } from "./_lib/dtos";

export const featuredPlaces = query({
  args: { surface: v.union(v.literal("home"), v.literal("explore")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const placements = await ctx.db
      .query("featured_placements")
      .withIndex("by_surface_status_order", (q) =>
        q.eq("surface", args.surface).eq("status", "published"))
      .collect();
    const out: Array<{
      id: string;
      name: string;
      slug: string;
      district: string | null;
      cover_image_path: string | null;
      short_description: string | null;
    }> = [];
    for (const row of placements.sort((a, b) => a.sort_order - b.sort_order)) {
      if (row.starts_at !== undefined && row.starts_at > now) continue;
      if (row.ends_at !== undefined && row.ends_at < now) continue;
      if (row.target_type !== "place") continue;
      const place = await ctx.db.get(row.target_id as Id<"places">);
      if (!place || !isPublicPlace(place)) continue;
      out.push({
        id: place._id,
        name: place.name,
        slug: place.slug,
        district: place.district ?? null,
        cover_image_path: place.cover_image_path ?? null,
        short_description: place.short_description ?? null,
      });
    }
    return out;
  },
});
