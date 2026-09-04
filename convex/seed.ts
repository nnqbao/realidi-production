import type { GenericDataModel, GenericMutationCtx, GenericQueryCtx } from "convex/server";
import {
  internalMutationGeneric, internalQueryGeneric, mutationGeneric, queryGeneric,
} from "convex/server";
import { v, type GenericId, type Value } from "convex/values";
import { requirePlaceManager } from "./_lib/authz";
import { placeSearchText } from "./_lib/search";
import { pairKey } from "./_lib/uniqueness";
import { experienceStyles, moods, placeCategories } from "./seed/catalog";
import { feedRankingConfig, featureFlags, rankingConfig } from "./seed/defaults";
import { editorialPlaces, placeMoods, placeStyles } from "./seed/editorialPlaces";

const SEED_TIME = Date.UTC(2026, 8, 3);
type MutationCtx = GenericMutationCtx<GenericDataModel>;
type QueryCtx = GenericQueryCtx<GenericDataModel>;

type SeedCounts = {
  moods: number; experience_styles: number; place_categories: number; places: number;
  place_moods: number; place_styles: number; ranking_config: number;
  feed_ranking_config: number; feature_flags: number;
};

const expectedCounts: SeedCounts = {
  moods: moods.length,
  experience_styles: experienceStyles.length,
  place_categories: placeCategories.length,
  places: editorialPlaces.length,
  place_moods: Object.values(placeMoods).reduce((total, values) => total + values.length, 0),
  place_styles: Object.values(placeStyles).reduce((total, values) => total + values.length, 0),
  ranking_config: 1,
  feed_ranking_config: 1,
  feature_flags: featureFlags.length,
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function checksum(value: unknown): string {
  const input = canonical(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export const SEED_CHECKSUM = checksum({
  moods, experienceStyles, placeCategories, editorialPlaces,
  placeMoods, placeStyles, rankingConfig, feedRankingConfig, featureFlags,
});

function differs(existing: Record<string, unknown>, desired: Record<string, Value>): boolean {
  return Object.entries(desired).some(([key, value]) => canonical(existing[key]) !== canonical(value));
}

async function upsert(
  ctx: MutationCtx,
  table: string,
  index: string,
  field: string,
  value: string,
  desired: Record<string, Value>,
): Promise<"inserted" | "updated" | "unchanged"> {
  const existing = await ctx.db.query(table)
    .withIndex(index, (query) => query.eq(field, value))
    .unique();
  if (existing === null) {
    await ctx.db.insert(table, desired);
    return "inserted";
  }
  if (!differs(existing, desired)) return "unchanged";
  await ctx.db.patch(existing._id as GenericId<string>, desired);
  return "updated";
}

export async function seedDatabase(ctx: MutationCtx) {
  let logical_inserts = 0;
  let logical_updates = 0;
  const apply = async (result: Promise<"inserted" | "updated" | "unchanged">) => {
    const outcome = await result;
    if (outcome === "inserted") logical_inserts += 1;
    if (outcome === "updated") logical_updates += 1;
  };

  for (const [slug, layer, nameVi, nameEn, descriptionVi, descriptionEn,
    promptVi, promptEn, colorToken, icon, sortOrder] of moods) {
    const desired = {
      seed_key: `mood:${slug}`, slug, layer, name_vi: nameVi, name_en: nameEn,
      description_vi: descriptionVi, description_en: descriptionEn,
      ...(promptVi === null ? {} : { prompt_vi: promptVi }),
      ...(promptEn === null ? {} : { prompt_en: promptEn }),
      color_token: colorToken, icon, is_active: true, sort_order: sortOrder,
      created_at: SEED_TIME, updated_at: SEED_TIME,
    };
    await apply(upsert(ctx, "moods", "by_seed_key", "seed_key", desired.seed_key, desired));
  }

  for (const [slug, nameVi, nameEn, descriptionVi, descriptionEn, icon, sortOrder] of experienceStyles) {
    const desired = {
      seed_key: `style:${slug}`, slug, name_vi: nameVi, name_en: nameEn,
      description_vi: descriptionVi, description_en: descriptionEn, icon,
      is_active: true, sort_order: sortOrder, created_at: SEED_TIME, updated_at: SEED_TIME,
    };
    await apply(upsert(ctx, "experience_styles", "by_seed_key", "seed_key", desired.seed_key, desired));
  }

  for (const [slug, nameVi, nameEn, icon, duration, sortOrder] of placeCategories) {
    const desired = {
      seed_key: `category:${slug}`, slug, name_vi: nameVi, name_en: nameEn, icon,
      typical_duration_minutes: duration, is_active: true, sort_order: sortOrder,
      created_at: SEED_TIME, updated_at: SEED_TIME,
    };
    await apply(upsert(ctx, "place_categories", "by_seed_key", "seed_key", desired.seed_key, desired));
  }

  const categories = new Map<string, GenericId<string>>();
  for (const [slug] of placeCategories) {
    const row = await ctx.db.query("place_categories")
      .withIndex("by_slug", (query) => query.eq("slug", slug)).unique();
    if (row === null) throw new Error(`Seed category missing: ${slug}`);
    categories.set(slug, row._id as GenericId<string>);
  }

  for (const place of editorialPlaces) {
    const desired = {
      seed_key: `place:${place.slug}`, slug: place.slug, name: place.name,
      normalized_search: placeSearchText(place), short_description: place.short_description,
      description: place.description, category_id: categories.get(place.category)!,
      address: place.address, district: place.district, city: "TP. Hồ Chí Minh", country: "VN",
      latitude_e6: place.latitude_e6, longitude_e6: place.longitude_e6,
      cover_image_path: place.cover_image_path, ...(place.website ? { website: place.website } : {}),
      price_level: place.price_level, typical_duration_minutes: place.typical_duration_minutes,
      typical_spend_min: place.typical_spend_min, typical_spend_max: place.typical_spend_max,
      currency: "VND", status: "active", source: "editorial", verified_by_admin: true,
      editorial_score: place.editorial_score, admin_quality_score: place.admin_quality_score,
      created_at: SEED_TIME, updated_at: SEED_TIME,
    };
    await apply(upsert(ctx, "places", "by_seed_key", "seed_key", desired.seed_key, desired));
  }

  const moodIds = new Map<string, GenericId<string>>();
  for (const [slug] of moods) {
    const row = await ctx.db.query("moods").withIndex("by_slug", (query) => query.eq("slug", slug)).unique();
    if (row === null) throw new Error(`Seed mood missing: ${slug}`);
    moodIds.set(slug, row._id as GenericId<string>);
  }
  const styleIds = new Map<string, GenericId<string>>();
  for (const [slug] of experienceStyles) {
    const row = await ctx.db.query("experience_styles")
      .withIndex("by_slug", (query) => query.eq("slug", slug)).unique();
    if (row === null) throw new Error(`Seed style missing: ${slug}`);
    styleIds.set(slug, row._id as GenericId<string>);
  }
  const placeIds = new Map<string, GenericId<string>>();
  for (const place of editorialPlaces) {
    const row = await ctx.db.query("places")
      .withIndex("by_slug", (query) => query.eq("slug", place.slug)).unique();
    if (row === null) throw new Error(`Seed place missing: ${place.slug}`);
    placeIds.set(place.slug, row._id as GenericId<string>);
  }

  for (const [placeSlug, associations] of Object.entries(placeMoods)) {
    for (const [moodSlug, weight] of associations) {
      const placeId = placeIds.get(placeSlug)!;
      const moodId = moodIds.get(moodSlug)!;
      const key = pairKey(placeId, moodId);
      await apply(upsert(ctx, "place_moods", "by_pair", "pair_key", key, {
        seed_key: `place-mood:${placeSlug}:${moodSlug}`,
        place_id: placeId, mood_id: moodId, pair_key: key,
        weight, source: "editorial", created_at: SEED_TIME,
      }));
    }
  }

  for (const [placeSlug, associations] of Object.entries(placeStyles)) {
    for (const styleSlug of associations) {
      const placeId = placeIds.get(placeSlug)!;
      const styleId = styleIds.get(styleSlug)!;
      const key = pairKey(placeId, styleId);
      await apply(upsert(ctx, "place_styles", "by_pair", "pair_key", key, {
        seed_key: `place-style:${placeSlug}:${styleSlug}`,
        place_id: placeId, style_id: styleId, pair_key: key, created_at: SEED_TIME,
      }));
    }
  }

  await apply(upsert(ctx, "ranking_config", "by_seed_key", "seed_key", rankingConfig.seed_key, {
    ...rankingConfig, updated_at: SEED_TIME,
  }));
  await apply(upsert(ctx, "feed_ranking_config", "by_seed_key", "seed_key", feedRankingConfig.seed_key, {
    ...feedRankingConfig, updated_at: SEED_TIME,
  }));
  for (const [key, enabled, description] of featureFlags) {
    await apply(upsert(ctx, "feature_flags", "by_seed_key", "seed_key", `flag:${key}`, {
      seed_key: `flag:${key}`, key, enabled, description, updated_at: SEED_TIME,
    }));
  }

  return { logical_inserts, logical_updates, counts: expectedCounts, checksum: SEED_CHECKSUM };
}

async function seedStatus(ctx: QueryCtx) {
  const counts: SeedCounts = {
    moods: (await ctx.db.query("moods").collect()).filter((row) => typeof row.seed_key === "string" && row.seed_key.startsWith("mood:")).length,
    experience_styles: (await ctx.db.query("experience_styles").collect()).filter((row) => typeof row.seed_key === "string" && row.seed_key.startsWith("style:")).length,
    place_categories: (await ctx.db.query("place_categories").collect()).filter((row) => typeof row.seed_key === "string" && row.seed_key.startsWith("category:")).length,
    places: (await ctx.db.query("places").collect()).filter((row) => typeof row.seed_key === "string" && row.seed_key.startsWith("place:")).length,
    place_moods: (await ctx.db.query("place_moods").collect()).filter((row) =>
      typeof row.seed_key === "string" && row.seed_key.startsWith("place-mood:")).length,
    place_styles: (await ctx.db.query("place_styles").collect()).filter((row) =>
      typeof row.seed_key === "string" && row.seed_key.startsWith("place-style:")).length,
    ranking_config: (await ctx.db.query("ranking_config").collect()).filter((row) => row.seed_key === rankingConfig.seed_key).length,
    feed_ranking_config: (await ctx.db.query("feed_ranking_config").collect()).filter((row) => row.seed_key === feedRankingConfig.seed_key).length,
    feature_flags: (await ctx.db.query("feature_flags").collect()).filter((row) => typeof row.seed_key === "string" && row.seed_key.startsWith("flag:")).length,
  };
  return {
    counts,
    expected_counts: expectedCounts,
    complete: canonical(counts) === canonical(expectedCounts),
    checksum: SEED_CHECKSUM,
  };
}

const runDefinition = {
  args: {},
  returns: v.object({
    logical_inserts: v.number(), logical_updates: v.number(),
    counts: v.object({
      moods: v.number(), experience_styles: v.number(), place_categories: v.number(),
      places: v.number(), place_moods: v.number(), place_styles: v.number(),
      ranking_config: v.number(), feed_ranking_config: v.number(), feature_flags: v.number(),
    }),
    checksum: v.string(),
  }),
} as const;

const statusDefinition = {
  args: {},
  returns: v.object({
    counts: v.object({
      moods: v.number(), experience_styles: v.number(), place_categories: v.number(),
      places: v.number(), place_moods: v.number(), place_styles: v.number(),
      ranking_config: v.number(), feed_ranking_config: v.number(), feature_flags: v.number(),
    }),
    expected_counts: v.object({
      moods: v.number(), experience_styles: v.number(), place_categories: v.number(),
      places: v.number(), place_moods: v.number(), place_styles: v.number(),
      ranking_config: v.number(), feed_ranking_config: v.number(), feature_flags: v.number(),
    }),
    complete: v.boolean(), checksum: v.string(),
  }),
} as const;

// CLI-only foundation entry points. `convex run` can invoke internal functions,
// but clients cannot obtain function references to them.
export const run = internalMutationGeneric({
  ...runDefinition,
  handler: seedDatabase,
});

export const status = internalQueryGeneric({
  ...statusDefinition,
  handler: seedStatus,
});

// Admin UI/test entry points remain public and always authorize server-derived identity.
export const runAuthorized = mutationGeneric({
  ...runDefinition,
  handler: async (ctx) => {
    await requirePlaceManager(ctx);
    return await seedDatabase(ctx);
  },
});

export const statusAuthorized = queryGeneric({
  ...statusDefinition,
  handler: async (ctx) => {
    await requirePlaceManager(ctx);
    return await seedStatus(ctx);
  },
});
