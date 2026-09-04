import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { requirePlaceManager } from "./_lib/authz";
import { appendAudit } from "./_lib/audit";
import { degreesToE6 } from "./_lib/geo";
import { normalizeSearchText, placeSearchText } from "./_lib/search";
import { placeStatus } from "./validators";

const importRow = v.object({
  line: v.number(),
  name: v.string(),
  slug: v.string(),
  latitude: v.number(),
  longitude: v.number(),
  shortDescription: v.optional(v.string()),
  address: v.optional(v.string()),
  district: v.optional(v.string()),
  city: v.optional(v.string()),
  phone: v.optional(v.string()),
  website: v.optional(v.string()),
  status: placeStatus,
  externalProvider: v.optional(v.string()),
  externalProviderId: v.optional(v.string()),
});

function slugify(value: string) {
  return normalizeSearchText(value).replace(/\s+/g, "-").slice(0, 120);
}

export const preview = internalMutation({
  args: { rows: v.array(importRow) },
  handler: async (ctx, args) => {
    await requirePlaceManager(ctx);
    const results: Array<{ line: number; error?: string; ok?: boolean; skipped?: string }> = [];
    const accepted = [];
    const seen = new Set<string>();
    const seenProviders = new Set<string>();
    for (const row of args.rows) {
      if (
        !row.name.trim() ||
        !Number.isFinite(row.latitude) ||
        !Number.isFinite(row.longitude) ||
        row.latitude < -90 ||
        row.latitude > 90 ||
        row.longitude < -180 ||
        row.longitude > 180
      ) {
        results.push({ line: row.line, error: "Thiếu tên hoặc tọa độ không hợp lệ." });
        continue;
      }
      const slug = slugify(row.slug || row.name);
      if (seen.has(slug)) {
        results.push({ line: row.line, skipped: `Slug đã tồn tại: ${slug}` });
        continue;
      }
      const existing = await ctx.db.query("places").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
      if (existing) {
        results.push({ line: row.line, skipped: `Slug đã tồn tại: ${slug}` });
        continue;
      }
      const providerKey =
        row.externalProvider && row.externalProviderId
          ? `${row.externalProvider}:${row.externalProviderId}`
          : undefined;
      if (providerKey) {
        if (seenProviders.has(providerKey)) {
          results.push({ line: row.line, skipped: `Provider đã tồn tại: ${providerKey}` });
          continue;
        }
        const providerHit = await ctx.db
          .query("places")
          .withIndex("by_provider_key", (q) => q.eq("external_provider_key", providerKey))
          .unique();
        if (providerHit) {
          results.push({ line: row.line, skipped: `Provider đã tồn tại: ${providerKey}` });
          continue;
        }
        seenProviders.add(providerKey);
      }
      seen.add(slug);
      accepted.push({ ...row, slug });
      results.push({ line: row.line, ok: true });
    }
    return { results, accepted };
  },
});

export const applyChunk = internalMutation({
  args: { actorId: v.id("profiles"), rows: v.array(importRow) },
  handler: async (ctx, args) => {
    let inserted = 0;
    for (const row of args.rows.slice(0, 20)) {
      const existing = await ctx.db.query("places").withIndex("by_slug", (q) => q.eq("slug", row.slug)).unique();
      if (existing) continue;
      const now = Date.now();
      const providerKey =
        row.externalProvider && row.externalProviderId
          ? `${row.externalProvider}:${row.externalProviderId}`
          : undefined;
      await ctx.db.insert("places", {
        name: row.name,
        slug: row.slug,
        normalized_search: placeSearchText({
          name: row.name,
          district: row.district,
          address: row.address,
          short_description: row.shortDescription,
        }),
        short_description: row.shortDescription,
        address: row.address,
        district: row.district,
        city: row.city || "TP. Hồ Chí Minh",
        country: "VN",
        currency: "VND",
        latitude_e6: degreesToE6(row.latitude, "latitude"),
        longitude_e6: degreesToE6(row.longitude, "longitude"),
        phone: row.phone,
        website: row.website,
        editorial_score: 0.5,
        admin_quality_score: 0.5,
        status: row.status,
        source: "import",
        verified_by_admin: true,
        external_provider: row.externalProvider,
        external_provider_id: row.externalProviderId,
        external_provider_key: providerKey,
        created_by: args.actorId,
        updated_by: args.actorId,
        created_at: now,
        updated_at: now,
      });
      inserted += 1;
    }
    return { inserted };
  },
});

export const recordImport = internalMutation({
  args: { actorId: v.id("profiles"), inserted: v.number(), submitted: v.number() },
  handler: async (ctx, args) => {
    await appendAudit(ctx, {
      actor_id: args.actorId,
      action: "place_csv_import",
      target_type: "place",
      after: { imported: args.inserted, submitted: args.submitted },
      created_at: Date.now(),
    });
  },
});

type ImportLine = { line: number; error?: string; ok?: boolean; skipped?: string };

export const commit = action({
  args: { rows: v.array(importRow) },
  handler: async (ctx, args): Promise<{ inserted: number; results: ImportLine[] }> => {
    const preview = await ctx.runMutation(internal.imports.preview, { rows: args.rows });
    const accepted = preview.accepted;
    const identity = await ctx.runQuery(api.profiles.current, {});
    if (identity === null) throw new Error("UNAUTHENTICATED");
    let inserted = 0;
    for (let i = 0; i < accepted.length; i += 20) {
      const result = await ctx.runMutation(internal.imports.applyChunk, {
        actorId: identity.id,
        rows: accepted.slice(i, i + 20),
      });
      inserted += result.inserted;
    }
    await ctx.runMutation(internal.imports.recordImport, {
      actorId: identity.id,
      inserted,
      submitted: args.rows.length,
    });
    return { inserted, results: preview.results };
  },
});
