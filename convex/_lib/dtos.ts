import type { Doc, Id } from "../_generated/dataModel";
import { E6 } from "./geo";

export function iso(value: number | undefined): string | null {
  return value === undefined ? null : new Date(value).toISOString();
}

export function degreesFromE6(value: number | undefined): number | null {
  return value === undefined ? null : value / E6;
}

export function toMood(doc: Doc<"moods">) {
  return {
    id: doc._id,
    slug: doc.slug,
    layer: doc.layer,
    name_vi: doc.name_vi,
    name_en: doc.name_en,
    description_vi: doc.description_vi ?? null,
    description_en: doc.description_en ?? null,
    prompt_vi: doc.prompt_vi ?? null,
    prompt_en: doc.prompt_en ?? null,
    color_token: doc.color_token,
    icon: doc.icon ?? null,
    is_active: doc.is_active,
    sort_order: doc.sort_order,
  };
}

export function toStyle(doc: Doc<"experience_styles">) {
  return {
    id: doc._id,
    slug: doc.slug,
    name_vi: doc.name_vi,
    name_en: doc.name_en,
    description_vi: doc.description_vi ?? null,
    description_en: doc.description_en ?? null,
    icon: doc.icon ?? null,
    is_active: doc.is_active,
    sort_order: doc.sort_order,
  };
}

export function toCategory(doc: Doc<"place_categories">) {
  return {
    id: doc._id,
    slug: doc.slug,
    name_vi: doc.name_vi,
    name_en: doc.name_en,
    parent_id: doc.parent_id ?? null,
    icon: doc.icon ?? null,
    typical_duration_minutes: doc.typical_duration_minutes ?? null,
    is_active: doc.is_active,
    sort_order: doc.sort_order,
  };
}

export function toPlace(doc: Doc<"places">) {
  return {
    id: doc._id,
    slug: doc.slug,
    name: doc.name,
    short_description: doc.short_description ?? null,
    description: doc.description ?? null,
    category_id: doc.category_id ?? null,
    address: doc.address ?? null,
    district: doc.district ?? null,
    city: doc.city,
    country: doc.country,
    latitude: degreesFromE6(doc.latitude_e6),
    longitude: degreesFromE6(doc.longitude_e6),
    cover_image_path: doc.cover_image_path ?? null,
    phone: doc.phone ?? null,
    website: doc.website ?? null,
    opening_hours: doc.opening_hours ?? null,
    price_level: doc.price_level ?? null,
    typical_duration_minutes: doc.typical_duration_minutes ?? null,
    typical_spend_min: doc.typical_spend_min ?? null,
    typical_spend_max: doc.typical_spend_max ?? null,
    currency: doc.currency,
    status: doc.status,
    source: doc.source,
    editorial_score: doc.editorial_score,
    admin_quality_score: doc.admin_quality_score,
    verified_by_admin: doc.verified_by_admin,
    created_by: doc.created_by ?? null,
    merged_into_place_id: doc.merged_into_place_id ?? null,
    seo_title: doc.seo_title ?? null,
    seo_description: doc.seo_description ?? null,
    google_maps_url: doc.google_maps_url ?? null,
    archived_at: iso(doc.archived_at),
    deleted_at: iso(doc.deleted_at),
    updated_by: doc.updated_by ?? null,
    created_at: iso(doc.created_at) ?? new Date(0).toISOString(),
    updated_at: iso(doc.updated_at) ?? new Date(0).toISOString(),
  };
}

export function toAuthorLite(doc: Doc<"profiles">) {
  return {
    id: doc._id as string,
    username: doc.username,
    display_name: doc.display_name,
    avatar_path: null as string | null,
  };
}

export const HCMC_CITIES = ["TP. Hồ Chí Minh", "Ho Chi Minh City"] as const;
export const PLACE_CANDIDATE_CEILING = 80;
export const FEED_CANDIDATE_CEILING = 80;

export function isPublicPlace(doc: Doc<"places">): boolean {
  return (
    doc.deleted_at === undefined &&
    doc.archived_at === undefined &&
    (doc.status === "active" || doc.status === "temporarily_closed")
  );
}

export function isDiscoverablePlace(doc: Doc<"places">): boolean {
  return doc.deleted_at === undefined && doc.status === "active";
}

export type PlaceId = Id<"places">;
export type MoodId = Id<"moods">;
