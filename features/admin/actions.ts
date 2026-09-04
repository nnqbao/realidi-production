"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { requireUser } from "@/lib/auth/session";
import { assertAdmin, assertCanManagePlaces, assertCanModerate, assertStaff } from "@/lib/auth/roles";
import { moodAdminSchema, placeAdminSchema, rankingConfigSchema } from "@/lib/validation";
import { convexMutation } from "@/lib/convex/server";
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
  await convexMutation(api.moderation.hidePost, {
    postId: postId as Id<"experience_posts">,
    reason,
  });
  revalidatePath("/admin/posts");
}

export async function adminRestorePost(postId: string) {
  const session = await staff();
  assertCanModerate(session.profile.role);
  await convexMutation(api.moderation.restorePost, { postId: postId as Id<"experience_posts"> });
  revalidatePath("/admin/posts");
}

export async function adminResolveReport(reportId: string, status: "resolved" | "dismissed" | "investigating") {
  await staff();
  await convexMutation(api.moderation.resolveReport, {
    reportId: reportId as Id<"reports">,
    status,
  });
  revalidatePath("/admin/reports");
}

export async function adminVerifyVisit(verificationId: string, approve: boolean) {
  await staff();
  await convexMutation(api.moderation.reviewVerification, {
    verificationId: verificationId as Id<"visit_verifications">,
    approve,
  });
}

export async function adminUpsertMood(input: unknown) {
  await staff();
  const parsed = moodAdminSchema.parse(input);
  await convexMutation(api.editorial.upsertMood, parsed);
  revalidatePath("/admin/moods");
}

export async function adminUpsertPlace(input: unknown) {
  const session = await staff();
  assertCanManagePlaces(session.profile.role);
  const parsed = placeAdminSchema.parse(input);
  const result = await convexMutation(api.editorial.upsertPlace, {
    id: parsed.id ? (parsed.id as Id<"places">) : undefined,
    name: parsed.name,
    slug: parsed.slug,
    shortDescription: parsed.shortDescription,
    description: parsed.description,
    categoryId: parsed.categoryId ? (parsed.categoryId as Id<"place_categories">) : undefined,
    address: parsed.address,
    district: parsed.district,
    city: parsed.city,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    priceLevel: parsed.priceLevel,
    typicalDurationMinutes: parsed.typicalDurationMinutes,
    editorialScore: parsed.editorialScore,
    adminQualityScore: parsed.adminQualityScore,
    status: parsed.status,
    phone: parsed.phone,
    website: parsed.website,
    googleMapsUrl: parsed.googleMapsUrl,
    seoTitle: parsed.seoTitle,
    seoDescription: parsed.seoDescription,
    coverImagePath: parsed.coverImagePath,
  });
  if (!parsed.id) await recordProductEvent("admin_place_created", { slug: parsed.slug });
  if (parsed.status === "active") await recordProductEvent("admin_place_published", { slug: parsed.slug });
  revalidatePath("/admin/places");
  return result;
}

export async function adminMergePlaces(fromId: string, intoId: string) {
  await staff();
  await convexMutation(api.editorial.mergePlaces, {
    fromId: fromId as Id<"places">,
    intoId: intoId as Id<"places">,
  });
  revalidatePath("/admin/places");
}

export async function adminUpdateRanking(input: unknown) {
  const session = await requireUser();
  assertAdmin(session.profile.role);
  const parsed = rankingConfigSchema.parse(input);
  await convexMutation(api.admin.updateRanking, parsed);
  revalidatePath("/admin/ranking");
}

export async function adminToggleFlag(key: string, enabled: boolean) {
  const session = await requireUser();
  assertAdmin(session.profile.role);
  await convexMutation(api.admin.toggleFlag, { key, enabled });
  revalidatePath("/admin/settings");
}

export async function adminSetUserRole(userId: string, role: "user" | "creator" | "moderator" | "admin") {
  const { adminChangeRole } = await import("./console-actions");
  await adminChangeRole(userId, role, "set_role");
}

export async function adminRemoveComment(commentId: string) {
  await staff();
  await convexMutation(api.moderation.removeComment, { commentId: commentId as Id<"comments"> });
  revalidatePath("/admin/comments");
}

export async function adminSuspendUser(userId: string, suspend: boolean) {
  const { adminSetUserStatus } = await import("./console-actions");
  await adminSetUserStatus({
    userId,
    action: suspend ? "suspend" : "unsuspend",
    reason: suspend ? "admin_suspend" : "admin_unsuspend",
  });
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
  await convexMutation(api.admin.updateFeedRanking, input);
  revalidatePath("/admin/feed");
}
