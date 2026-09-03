"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/session";
import { assertAdmin, assertStaff, assertCanManagePlaces, assertCanModerate } from "@/lib/auth/roles";
import { moodAdminSchema, placeAdminSchema, rankingConfigSchema } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/utils";
import { writeAuditLog } from "@/lib/auth/audit";
import { recordProductEvent } from "@/features/social/actions";

async function staff() {
  const session = await requireUser();
  assertStaff(session.profile.role);
  return session;
}

export async function adminHidePost(postId: string, reason: string) {
  const session = await staff();
  assertCanModerate(session.profile.role);
  if (!reason.trim()) throw new Error("REASON_REQUIRED");
  const supabase = await createServerSupabase();
  await supabase.from("experience_posts").update({ moderation_status: "hidden", status: "hidden" }).eq("id", postId);
  await supabase.from("moderation_actions").insert({
    actor_id: session.user.id,
    target_type: "post",
    target_id: postId,
    action: "hide",
    reason,
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "post_hidden",
    targetType: "post",
    targetId: postId,
    reason,
  });
  revalidatePath("/admin/posts");
}

export async function adminRestorePost(postId: string) {
  const session = await staff();
  assertCanModerate(session.profile.role);
  const supabase = await createServerSupabase();
  await supabase
    .from("experience_posts")
    .update({ moderation_status: "approved", status: "published" })
    .eq("id", postId);
  await supabase.from("moderation_actions").insert({
    actor_id: session.user.id,
    target_type: "post",
    target_id: postId,
    action: "restore",
  });
  await writeAuditLog({
    actorId: session.user.id,
    action: "post_restored",
    targetType: "post",
    targetId: postId,
  });
  revalidatePath("/admin/posts");
}

export async function adminResolveReport(reportId: string, status: "resolved" | "dismissed" | "investigating") {
  const session = await staff();
  const supabase = await createServerSupabase();
  await supabase
    .from("reports")
    .update({
      status,
      resolved_by: status === "investigating" ? null : session.user.id,
      resolved_at: status === "investigating" ? null : new Date().toISOString(),
    })
    .eq("id", reportId);
  await supabase.from("moderation_actions").insert({
    actor_id: session.user.id,
    target_type: "report",
    target_id: reportId,
    action: status,
  });
  revalidatePath("/admin/reports");
}

export async function adminVerifyVisit(verificationId: string, approve: boolean) {
  const session = await staff();
  const supabase = await createServerSupabase();
  const result = approve ? "verified" : "failed";
  await supabase
    .from("visit_verifications")
    .update({
      result,
      method: "admin",
      verified_at: approve ? new Date().toISOString() : null,
      confidence: approve ? 1 : 0,
    })
    .eq("id", verificationId);
  await supabase.from("moderation_actions").insert({
    actor_id: session.user.id,
    target_type: "place",
    target_id: verificationId,
    action: approve ? "admin_verify" : "admin_reject_verify",
  });
}

export async function adminUpsertMood(input: unknown) {
  const session = await staff();
  const parsed = moodAdminSchema.parse(input);
  const supabase = await createServerSupabase();
  const { data: existing } = await supabase.from("moods").select("id").eq("slug", parsed.slug).maybeSingle();
  const payload = {
    slug: parsed.slug,
    layer: parsed.layer,
    name_vi: parsed.nameVi,
    name_en: parsed.nameEn,
    description_vi: parsed.descriptionVi,
    description_en: parsed.descriptionEn,
    color_token: parsed.colorToken,
    is_active: parsed.isActive,
    sort_order: parsed.sortOrder,
  };
  if (existing) {
    await supabase.from("moods").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("moods").insert(payload);
  }
  await supabase.from("moderation_actions").insert({
    actor_id: session.user.id,
    target_type: "place",
    target_id: session.user.id,
    action: "upsert_mood",
    metadata: { slug: parsed.slug },
  });
  revalidatePath("/admin/moods");
}

export async function adminUpsertPlace(input: unknown) {
  const session = await staff();
  assertCanManagePlaces(session.profile.role);
  const parsed = placeAdminSchema.parse(input);
  const supabase = await createServerSupabase();
  const { data: slugHit } = await supabase.from("places").select("id").eq("slug", parsed.slug).maybeSingle();
  if (slugHit && slugHit.id !== parsed.id) {
    throw new Error("SLUG_TAKEN");
  }
  const existingId = parsed.id ?? slugHit?.id ?? null;
  const payload = {
    name: parsed.name,
    slug: parsed.slug || slugify(parsed.name),
    short_description: parsed.shortDescription,
    description: parsed.description,
    category_id: parsed.categoryId,
    address: parsed.address,
    district: parsed.district,
    city: parsed.city,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    price_level: parsed.priceLevel,
    typical_duration_minutes: parsed.typicalDurationMinutes,
    editorial_score: parsed.editorialScore,
    admin_quality_score: parsed.adminQualityScore,
    status: parsed.status,
    phone: parsed.phone ?? null,
    website: parsed.website ?? null,
    google_maps_url: parsed.googleMapsUrl ?? null,
    seo_title: parsed.seoTitle ?? null,
    seo_description: parsed.seoDescription ?? null,
    cover_image_path: parsed.coverImagePath ?? undefined,
    source: "editorial" as const,
    verified_by_admin: true,
    created_by: session.user.id,
    updated_by: session.user.id,
  };
  if (existingId) {
    const updatePayload = { ...payload };
    delete (updatePayload as { created_by?: string }).created_by;
    await supabase.from("places").update(updatePayload).eq("id", existingId);
  } else {
    await supabase.from("places").insert(payload);
    await recordProductEvent("admin_place_created", { slug: payload.slug });
  }
  if (payload.status === "active") {
    await recordProductEvent("admin_place_published", { slug: payload.slug });
  }
  await writeAuditLog({
    actorId: session.user.id,
    action: existingId ? "place_updated" : "place_created",
    targetType: "place",
    targetId: existingId,
    after: { slug: payload.slug, status: payload.status },
  });
  revalidatePath("/admin/places");
}

export async function adminMergePlaces(fromId: string, intoId: string) {
  await staff();
  const supabase = await createServerSupabase();
  await supabase
    .from("places")
    .update({ status: "merged", merged_into_place_id: intoId })
    .eq("id", fromId);
  revalidatePath("/admin/places");
}

export async function adminUpdateRanking(input: unknown) {
  const session = await requireUser();
  assertAdmin(session.profile.role);
  const parsed = rankingConfigSchema.parse(input);
  const sum =
    parsed.moodMatchWeight +
    parsed.trustWeight +
    parsed.freshnessWeight +
    parsed.proximityWeight +
    parsed.qualityEngagementWeight;
  if (Math.abs(sum - 1) > 0.001) throw new Error("WEIGHTS_MUST_SUM_TO_1");
  const supabase = await createServerSupabase();
  await supabase
    .from("ranking_config")
    .update({
      mood_match_weight: parsed.moodMatchWeight,
      trust_weight: parsed.trustWeight,
      freshness_weight: parsed.freshnessWeight,
      proximity_weight: parsed.proximityWeight,
      quality_engagement_weight: parsed.qualityEngagementWeight,
      bayesian_prior_mean: parsed.bayesianPriorMean,
      bayesian_prior_strength: parsed.bayesianPriorStrength,
      geofence_radius_meters: parsed.geofenceRadiusMeters,
      updated_by: session.user.id,
    })
    .eq("id", "default");
  revalidatePath("/admin/ranking");
}

export async function adminToggleFlag(key: string, enabled: boolean) {
  const session = await requireUser();
  assertAdmin(session.profile.role);
  const supabase = await createServerSupabase();
  await supabase.from("feature_flags").update({ enabled, updated_by: session.user.id }).eq("key", key);
  revalidatePath("/admin/settings");
}

export async function adminSetUserRole(userId: string, role: "user" | "creator" | "moderator" | "admin") {
  const session = await requireUser();
  assertAdmin(session.profile.role);
  const admin = createAdminClient();
  await admin.from("profiles").update({ role }).eq("id", userId);
  await createServerSupabase().then((s) =>
    s.from("moderation_actions").insert({
      actor_id: session.user.id,
      target_type: "user",
      target_id: userId,
      action: "set_role",
      metadata: { role } as never,
    }),
  );
  revalidatePath("/admin/users");
}

export async function adminRemoveComment(commentId: string) {
  const session = await staff();
  const supabase = await createServerSupabase();
  await supabase.from("comments").update({ deleted_at: new Date().toISOString(), moderation_status: "removed" }).eq("id", commentId);
  await supabase.from("moderation_actions").insert({
    actor_id: session.user.id,
    target_type: "comment",
    target_id: commentId,
    action: "remove_comment",
  });
  revalidatePath("/admin/comments");
}

export async function adminSuspendUser(userId: string, suspend: boolean) {
  const session = await requireUser();
  assertAdmin(session.profile.role);
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ suspended_at: suspend ? new Date().toISOString() : null })
    .eq("id", userId);
  await createServerSupabase().then((s) =>
    s.from("moderation_actions").insert({
      actor_id: session.user.id,
      target_type: "user",
      target_id: userId,
      action: suspend ? "suspend" : "unsuspend",
    }),
  );
  revalidatePath("/admin/users");
}

export async function adminUpdateFeedRanking(input: {
  socialAffinityWeight: number;
  contentRelevanceWeight: number;
  recencyWeight: number;
  verifiedWeight: number;
  qualityEngagementWeight: number;
  moodContextWeight: number;
  locationWeight: number;
}) {
  const session = await requireUser();
  assertAdmin(session.profile.role);
  const sum =
    input.socialAffinityWeight +
    input.contentRelevanceWeight +
    input.recencyWeight +
    input.verifiedWeight +
    input.qualityEngagementWeight +
    input.moodContextWeight +
    input.locationWeight;
  if (Math.abs(sum - 1) > 0.001) throw new Error("WEIGHTS_MUST_SUM_TO_1");
  const supabase = await createServerSupabase();
  await supabase
    .from("feed_ranking_config")
    .update({
      social_affinity_weight: input.socialAffinityWeight,
      content_relevance_weight: input.contentRelevanceWeight,
      recency_weight: input.recencyWeight,
      verified_weight: input.verifiedWeight,
      quality_engagement_weight: input.qualityEngagementWeight,
      mood_context_weight: input.moodContextWeight,
      location_weight: input.locationWeight,
    })
    .eq("id", "default");
  revalidatePath("/admin/feed");
}
