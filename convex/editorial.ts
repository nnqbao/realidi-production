import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlaceManager, requireStaff } from "./_lib/authz";
import { appendAudit } from "./_lib/audit";
import { iso } from "./_lib/dtos";
import { invariant } from "./_lib/errors";
import { degreesToE6 } from "./_lib/geo";
import { normalizeSearchText, placeSearchText } from "./_lib/search";
import { editorialKind, editorialStatus, featuredSurface, moodLayer, placeStatus } from "./validators";

function slugify(value: string) {
  return normalizeSearchText(value).replace(/\s+/g, "-").slice(0, 120);
}

export const listPlaces = query({
  args: { query: v.optional(v.string()), status: v.optional(v.string()), page: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const pageSize = 30;
    const page = Math.max(1, args.page ?? 1);
    const rows = await ctx.db.query("places").take(200);
    const needle = args.query?.trim().toLowerCase() ?? "";
    const filtered = rows.filter((row) => {
      if (args.status === "deleted") return row.deleted_at !== undefined;
      if (row.deleted_at !== undefined) return false;
      if (args.status && row.status !== args.status) return false;
      if (!needle) return true;
      return `${row.name} ${row.district ?? ""} ${row.slug}`.toLowerCase().includes(needle);
    });
    const start = (page - 1) * pageSize;
    return {
      items: filtered.slice(start, start + pageSize).map((row) => ({
        id: row._id as string,
        name: row.name,
        slug: row.slug,
        status: row.status,
        district: row.district ?? null,
        deleted_at: iso(row.deleted_at),
      })),
      total: filtered.length,
      page,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    };
  },
});

export const getPlace = query({
  args: { placeId: v.id("places") },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const place = await ctx.db.get(args.placeId);
    if (place === null) return null;
    const others = await ctx.db.query("places").take(80);
    const media = await ctx.db
      .query("place_media")
      .withIndex("by_place_order", (q) => q.eq("place_id", args.placeId))
      .take(20);
    const mediaOut = [];
    for (const row of media) {
      mediaOut.push({
        id: row._id as string,
        url: await ctx.storage.getUrl(row.storage_id),
        alt_text: row.alt_text ?? null,
      });
    }
    return {
      place: {
        id: place._id as string,
        name: place.name,
        slug: place.slug,
        short_description: place.short_description ?? null,
        description: place.description ?? null,
        category_id: place.category_id ?? null,
        address: place.address ?? null,
        district: place.district ?? null,
        city: place.city,
        latitude: place.latitude_e6 === undefined ? null : place.latitude_e6 / 1_000_000,
        longitude: place.longitude_e6 === undefined ? null : place.longitude_e6 / 1_000_000,
        editorial_score: place.editorial_score,
        admin_quality_score: place.admin_quality_score,
        status: place.status,
        phone: place.phone ?? null,
        website: place.website ?? null,
        google_maps_url: place.google_maps_url ?? null,
        seo_title: place.seo_title ?? null,
        seo_description: place.seo_description ?? null,
        typical_duration_minutes: place.typical_duration_minutes ?? null,
        deleted_at: iso(place.deleted_at),
      },
      others: others
        .filter((row) => row._id !== place._id && row.deleted_at === undefined)
        .map((row) => ({
          id: row._id as string,
          name: row.name,
          address: row.address ?? null,
          latitude: row.latitude_e6 === undefined ? null : row.latitude_e6 / 1_000_000,
          longitude: row.longitude_e6 === undefined ? null : row.longitude_e6 / 1_000_000,
        })),
      media: mediaOut,
    };
  },
});

export const listMoods = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const rows = await ctx.db.query("moods").take(80);
    return rows
      .sort((a, b) => a.layer.localeCompare(b.layer) || a.sort_order - b.sort_order)
      .map((row) => ({
        id: row._id as string,
        slug: row.slug,
        layer: row.layer,
        name_vi: row.name_vi,
        name_en: row.name_en,
        description_vi: row.description_vi ?? null,
        description_en: row.description_en ?? null,
        color_token: row.color_token,
        is_active: row.is_active,
        sort_order: row.sort_order,
      }));
  },
});

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const rows = await ctx.db.query("place_categories").take(80);
    return rows
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((row) => ({
        id: row._id as string,
        slug: row.slug,
        name_vi: row.name_vi,
        is_active: row.is_active,
      }));
  },
});

export const listCollections = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const collections = await ctx.db.query("editorial_collections").take(40);
    const featured = await ctx.db.query("featured_placements").take(40);
    return {
      collections: collections
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((row) => ({
          id: row._id as string,
          title: row.title,
          kind: row.kind,
          status: row.status,
        })),
      featured: featured
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((row) => ({
          id: row._id as string,
          surface: row.surface,
          target_type: row.target_type,
          target_id: row.target_id,
          status: row.status,
        })),
    };
  },
});

export const upsertMood = mutation({
  args: {
    slug: v.string(),
    layer: moodLayer,
    nameVi: v.string(),
    nameEn: v.string(),
    descriptionVi: v.optional(v.union(v.string(), v.null())),
    descriptionEn: v.optional(v.union(v.string(), v.null())),
    colorToken: v.string(),
    isActive: v.boolean(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requirePlaceManager(ctx);
    const existing = await ctx.db.query("moods").withIndex("by_slug", (q) => q.eq("slug", args.slug)).unique();
    const now = Date.now();
    const payload = {
      slug: args.slug,
      layer: args.layer,
      name_vi: args.nameVi,
      name_en: args.nameEn,
      description_vi: args.descriptionVi ?? undefined,
      description_en: args.descriptionEn ?? undefined,
      color_token: args.colorToken,
      is_active: args.isActive,
      sort_order: args.sortOrder,
      updated_at: now,
    };
    if (existing) await ctx.db.patch(existing._id, payload);
    else await ctx.db.insert("moods", { ...payload, created_at: now });
    await appendAudit(ctx, {
      actor_id: profile._id,
      action: "upsert_mood",
      target_type: "place",
      after: { slug: args.slug },
      created_at: now,
    });
    return { ok: true as const };
  },
});

export const upsertPlace = mutation({
  args: {
    id: v.optional(v.id("places")),
    name: v.string(),
    slug: v.string(),
    shortDescription: v.optional(v.union(v.string(), v.null())),
    description: v.optional(v.union(v.string(), v.null())),
    categoryId: v.optional(v.union(v.id("place_categories"), v.null())),
    address: v.optional(v.union(v.string(), v.null())),
    district: v.optional(v.union(v.string(), v.null())),
    city: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    priceLevel: v.optional(v.union(v.number(), v.null())),
    typicalDurationMinutes: v.optional(v.union(v.number(), v.null())),
    editorialScore: v.number(),
    adminQualityScore: v.number(),
    status: placeStatus,
    phone: v.optional(v.union(v.string(), v.null())),
    website: v.optional(v.union(v.string(), v.null())),
    googleMapsUrl: v.optional(v.union(v.string(), v.null())),
    seoTitle: v.optional(v.union(v.string(), v.null())),
    seoDescription: v.optional(v.union(v.string(), v.null())),
    coverImagePath: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { profile } = await requirePlaceManager(ctx);
    const slug = args.slug || slugify(args.name);
    const slugHit = await ctx.db.query("places").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
    invariant(slugHit === null || slugHit._id === args.id, "CONFLICT", "SLUG_TAKEN");
    const now = Date.now();
    const latitude_e6 = degreesToE6(args.latitude, "latitude");
    const longitude_e6 = degreesToE6(args.longitude, "longitude");
    const fields = {
      name: args.name,
      slug,
      normalized_search: placeSearchText({
        name: args.name,
        district: args.district ?? undefined,
        address: args.address ?? undefined,
        short_description: args.shortDescription ?? undefined,
      }),
      short_description: args.shortDescription ?? undefined,
      description: args.description ?? undefined,
      category_id: args.categoryId ?? undefined,
      address: args.address ?? undefined,
      district: args.district ?? undefined,
      city: args.city,
      latitude_e6,
      longitude_e6,
      price_level: args.priceLevel ?? undefined,
      typical_duration_minutes: args.typicalDurationMinutes ?? undefined,
      editorial_score: args.editorialScore,
      admin_quality_score: args.adminQualityScore,
      status: args.status,
      phone: args.phone ?? undefined,
      website: args.website ?? undefined,
      google_maps_url: args.googleMapsUrl ?? undefined,
      seo_title: args.seoTitle ?? undefined,
      seo_description: args.seoDescription ?? undefined,
      cover_image_path: args.coverImagePath ?? undefined,
      source: "editorial" as const,
      verified_by_admin: true,
      updated_by: profile._id,
      updated_at: now,
    };
    let placeId = args.id;
    if (placeId) {
      await ctx.db.patch(placeId, fields);
    } else {
      placeId = await ctx.db.insert("places", {
        ...fields,
        country: "VN",
        currency: "VND",
        created_by: profile._id,
        created_at: now,
      });
    }
    await appendAudit(ctx, {
      actor_id: profile._id,
      action: args.id ? "place_updated" : "place_created",
      target_type: "place",
      target_id: placeId,
      after: { slug, status: args.status },
      created_at: now,
    });
    return { id: placeId as string };
  },
});

export const mergePlaces = mutation({
  args: { fromId: v.id("places"), intoId: v.id("places") },
  handler: async (ctx, args) => {
    const { profile } = await requirePlaceManager(ctx);
    invariant(args.fromId !== args.intoId, "VALIDATION_FAILED", "SAME_PLACE");
    const from = await ctx.db.get(args.fromId);
    const into = await ctx.db.get(args.intoId);
    invariant(from !== null && into !== null, "NOT_FOUND", "Place not found");
    await ctx.db.patch(args.fromId, {
      status: "merged",
      merged_into_place_id: args.intoId,
      updated_by: profile._id,
      updated_at: Date.now(),
    });
    await appendAudit(ctx, {
      actor_id: profile._id,
      action: "place_merged",
      target_type: "place",
      target_id: args.fromId,
      after: { into: args.intoId },
      created_at: Date.now(),
    });
    return { ok: true as const };
  },
});

export const setPlaceStatus = mutation({
  args: {
    placeId: v.id("places"),
    status: v.union(v.literal("active"), v.literal("hidden"), v.literal("draft"), v.literal("archived")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requirePlaceManager(ctx);
    const now = Date.now();
    const extra =
      args.status === "archived"
        ? { archived_at: now, deleted_at: undefined }
        : args.status === "active"
          ? { archived_at: undefined, deleted_at: undefined }
          : {};
    await ctx.db.patch(args.placeId, {
      status: args.status,
      updated_by: profile._id,
      updated_at: now,
      ...extra,
    });
    await appendAudit(ctx, {
      actor_id: profile._id,
      action: `place_${args.status}`,
      target_type: "place",
      target_id: args.placeId,
      reason: args.reason,
      after: { status: args.status },
      created_at: now,
    });
    return { ok: true as const };
  },
});

export const softDeletePlace = mutation({
  args: { placeId: v.id("places"), reason: v.string() },
  handler: async (ctx, args) => {
    const { profile } = await requirePlaceManager(ctx);
    const posts = await ctx.db
      .query("experience_posts")
      .withIndex("by_place_published", (q) => q.eq("place_id", args.placeId))
      .take(80);
    const now = Date.now();
    await ctx.db.patch(args.placeId, {
      deleted_at: now,
      status: "archived",
      updated_by: profile._id,
      updated_at: now,
    });
    await appendAudit(ctx, {
      actor_id: profile._id,
      action: "place_soft_deleted",
      target_type: "place",
      target_id: args.placeId,
      reason: args.reason,
      after: { referenced_posts: posts.length },
      created_at: now,
    });
    return { ok: true as const };
  },
});

export const restorePlace = mutation({
  args: { placeId: v.id("places") },
  handler: async (ctx, args) => {
    const { profile } = await requirePlaceManager(ctx);
    await ctx.db.patch(args.placeId, {
      deleted_at: undefined,
      archived_at: undefined,
      status: "draft",
      updated_by: profile._id,
      updated_at: Date.now(),
    });
    await appendAudit(ctx, {
      actor_id: profile._id,
      action: "place_restored",
      target_type: "place",
      target_id: args.placeId,
      created_at: Date.now(),
    });
    return { ok: true as const };
  },
});

export const saveCollection = mutation({
  args: {
    id: v.optional(v.id("editorial_collections")),
    slug: v.string(),
    title: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    kind: editorialKind,
    status: editorialStatus,
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requirePlaceManager(ctx);
    const now = Date.now();
    const slug = slugify(args.slug || args.title);
    const payload = {
      slug,
      title: args.title,
      description: args.description ?? undefined,
      kind: args.kind,
      status: args.status,
      sort_order: args.sortOrder,
      updated_by: profile._id,
      updated_at: now,
    };
    if (args.id) await ctx.db.patch(args.id, payload);
    else await ctx.db.insert("editorial_collections", { ...payload, created_by: profile._id, created_at: now });
    await appendAudit(ctx, {
      actor_id: profile._id,
      action: args.id ? "collection_updated" : "collection_created",
      target_type: "collection",
      target_id: args.id,
      after: { slug, status: args.status },
      created_at: now,
    });
    return { ok: true as const };
  },
});

export const setFeatured = mutation({
  args: {
    surface: featuredSurface,
    targetType: v.union(v.literal("place"), v.literal("post")),
    targetId: v.string(),
    status: editorialStatus,
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const { profile } = await requirePlaceManager(ctx);
    const now = Date.now();
    const live_key = `${args.surface}:${args.targetType}:${args.targetId}`;
    await ctx.db.insert("featured_placements", {
      surface: args.surface,
      target_type: args.targetType,
      target_id: args.targetId,
      live_key,
      sort_order: args.sortOrder,
      status: args.status,
      created_by: profile._id,
      updated_by: profile._id,
      created_at: now,
      updated_at: now,
    });
    await appendAudit(ctx, {
      actor_id: profile._id,
      action: "featured_set",
      target_type: args.targetType,
      target_id: args.targetId,
      after: { surface: args.surface, status: args.status },
      created_at: now,
    });
    return { ok: true as const };
  },
});

export const attachPlaceMedia = mutation({
  args: {
    placeId: v.id("places"),
    storageId: v.id("_storage"),
    altText: v.optional(v.string()),
    cover: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requirePlaceManager(ctx);
    const place = await ctx.db.get(args.placeId);
    invariant(place !== null, "NOT_FOUND", "Place not found");
    const existing = await ctx.db
      .query("place_media")
      .withIndex("by_place_order", (q) => q.eq("place_id", args.placeId))
      .take(20);
    await ctx.db.insert("place_media", {
      place_id: args.placeId,
      storage_id: args.storageId,
      alt_text: args.altText,
      sort_order: existing.length,
      created_by: profile._id,
      created_at: Date.now(),
    });
    const url = await ctx.storage.getUrl(args.storageId);
    if (args.cover && url) {
      await ctx.db.patch(args.placeId, {
        cover_image_path: url,
        updated_by: profile._id,
        updated_at: Date.now(),
      });
    }
    await appendAudit(ctx, {
      actor_id: profile._id,
      action: "place_media_uploaded",
      target_type: "place",
      target_id: args.placeId,
      after: { storageId: args.storageId },
      created_at: Date.now(),
    });
    return { ok: true as const, url };
  },
});
