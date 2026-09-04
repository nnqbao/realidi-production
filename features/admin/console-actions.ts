"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { requireUser } from "@/lib/auth/session";
import {
  assertAdmin,
  assertCanManagePlaces,
  assertCanModerate,
  assertStaff,
  canAssignRoles,
  isOwner,
  type UserRole,
} from "@/lib/auth/roles";
import { convexAction, convexMutation, convexQueryAuthed } from "@/lib/convex/server";
import { recordProductEvent } from "@/features/social/actions";
import { validateMediaFile } from "@/lib/media";
import { parseCsv, csvHeaderIndex } from "@/lib/csv";
import { slugify } from "@/lib/utils";
import type { PlaceStatus } from "@/types/database";

async function staffSession() {
  const session = await requireUser();
  assertStaff(session.profile.role);
  return session;
}

type PlaceImportRow = { line: number; error?: string; ok?: boolean; skipped?: string };

export async function adminDashboardStats() {
  await staffSession();
  return await convexQueryAuthed(api.admin.dashboard, {});
}

export async function adminAssignReport(reportId: string, assigneeId: string | null) {
  const session = await staffSession();
  assertCanModerate(session.profile.role);
  await convexMutation(api.moderation.assignReport, {
    reportId: reportId as Id<"reports">,
    assigneeId: assigneeId ? (assigneeId as Id<"profiles">) : null,
  });
  revalidatePath("/admin/reports");
}

export async function adminModerateReport(input: {
  reportId: string;
  decision: "dismissed" | "resolved";
  reason: string;
  hideTarget?: boolean;
  warnUserId?: string | null;
  suspendUserId?: string | null;
  suspendHours?: number | null;
  banUserId?: string | null;
}) {
  const session = await staffSession();
  assertCanModerate(session.profile.role);
  if ((input.suspendUserId || input.banUserId) && !input.reason.trim()) {
    return { error: "REASON_REQUIRED" as const };
  }
  if (input.banUserId) assertAdmin(session.profile.role);
  await convexMutation(api.moderation.moderateReport, {
    reportId: input.reportId as Id<"reports">,
    decision: input.decision,
    reason: input.reason,
    hideTarget: input.hideTarget,
  });
  if (input.suspendUserId) {
    await convexAction(api.admin.setUserStatus, {
      userId: input.suspendUserId as Id<"profiles">,
      action: "suspend",
      reason: input.reason,
      hours: input.suspendHours ?? undefined,
    });
    await recordProductEvent("admin_user_suspended", { target_user_id: input.suspendUserId });
  }
  if (input.banUserId) {
    await convexAction(api.admin.setUserStatus, {
      userId: input.banUserId as Id<"profiles">,
      action: "ban",
      reason: input.reason,
    });
  }
  await recordProductEvent("admin_report_actioned", { report_id: input.reportId });
  revalidatePath("/admin/reports");
  return { ok: true as const };
}

export async function adminChangeRole(userId: string, role: UserRole, reason: string) {
  const session = await requireUser();
  assertAdmin(session.profile.role);
  if (!canAssignRoles(session.profile.role, role)) return { error: "FORBIDDEN_ROLE" as const };
  const result = await convexAction(api.admin.changeRole, {
    userId: userId as Id<"profiles">,
    role,
    reason,
  });
  revalidatePath("/admin/users");
  return result;
}

export async function adminSetUserStatus(input: {
  userId: string;
  action: "suspend" | "unsuspend" | "ban" | "restore";
  reason: string;
  hours?: number | null;
}) {
  const session = await requireUser();
  assertAdmin(session.profile.role);
  const result = await convexAction(api.admin.setUserStatus, {
    userId: input.userId as Id<"profiles">,
    action: input.action,
    reason: input.reason,
    hours: input.hours ?? undefined,
  });
  if (input.action === "suspend" && !("error" in result)) {
    await recordProductEvent("admin_user_suspended", { target_user_id: input.userId });
  }
  revalidatePath("/admin/users");
  return result;
}

export async function adminUploadPlaceImage(placeId: string, formData: FormData) {
  const session = await staffSession();
  assertCanManagePlaces(session.profile.role);
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "NO_FILE" as const };
  if (file.name.toLowerCase().endsWith(".svg") || file.type === "image/svg+xml") {
    return { error: "SVG" as const };
  }
  const check = validateMediaFile(file);
  if (!check.ok) return { error: check.error };
  const uploadUrl = await convexMutation(api.files.generateUploadUrl, { purpose: "place" });
  const uploaded = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!uploaded.ok) return { error: "UPLOAD_FAILED" as const };
  const body = (await uploaded.json()) as { storageId?: string };
  if (!body.storageId) return { error: "UPLOAD_FAILED" as const };
  await convexMutation(api.files.finalize, {
    storageId: body.storageId as Id<"_storage">,
    purpose: "place",
    mimeType: file.type,
    byteSize: file.size,
  });
  const cover = formData.get("cover") === "on";
  const alt = String(formData.get("alt") ?? "").slice(0, 180);
  await convexMutation(api.editorial.attachPlaceMedia, {
    placeId: placeId as Id<"places">,
    storageId: body.storageId as Id<"_storage">,
    altText: alt || undefined,
    cover,
  });
  revalidatePath(`/admin/places/${placeId}`);
  return { ok: true as const, path: body.storageId };
}

export async function adminSaveCollection(input: {
  id?: string;
  slug: string;
  title: string;
  description?: string | null;
  kind: "place" | "post" | "mood" | "home" | "explore";
  status: "draft" | "published" | "archived";
  sortOrder: number;
}) {
  const session = await staffSession();
  assertCanManagePlaces(session.profile.role);
  await convexMutation(api.editorial.saveCollection, {
    id: input.id ? (input.id as Id<"editorial_collections">) : undefined,
    slug: input.slug,
    title: input.title,
    description: input.description,
    kind: input.kind,
    status: input.status,
    sortOrder: input.sortOrder,
  });
  revalidatePath("/admin/collections");
  return { ok: true as const };
}

export async function adminSetFeatured(input: {
  surface: "home" | "explore";
  targetType: "place" | "post";
  targetId: string;
  status: "draft" | "published";
  sortOrder: number;
}) {
  const session = await staffSession();
  assertCanManagePlaces(session.profile.role);
  await convexMutation(api.editorial.setFeatured, input);
  revalidatePath("/admin/collections");
  return { ok: true as const };
}

export async function adminSetPlaceStatus(placeId: string, status: "active" | "hidden" | "draft" | "archived", reason?: string) {
  const session = await staffSession();
  assertCanManagePlaces(session.profile.role);
  await convexMutation(api.editorial.setPlaceStatus, {
    placeId: placeId as Id<"places">,
    status,
    reason,
  });
  if (status === "active") await recordProductEvent("admin_place_published", { place_id: placeId });
  revalidatePath("/admin/places");
  revalidatePath(`/admin/places/${placeId}`);
  return { ok: true as const };
}

export async function adminSoftDeletePlace(placeId: string, reason: string) {
  const session = await staffSession();
  assertCanManagePlaces(session.profile.role);
  await convexMutation(api.editorial.softDeletePlace, {
    placeId: placeId as Id<"places">,
    reason,
  });
  revalidatePath("/admin/places");
  return { ok: true as const };
}

export async function adminRestorePlace(placeId: string) {
  const session = await staffSession();
  assertCanManagePlaces(session.profile.role);
  await convexMutation(api.editorial.restorePlace, { placeId: placeId as Id<"places"> });
  revalidatePath("/admin/places");
  return { ok: true as const };
}

export async function adminImportPlacesCsv(formData: FormData) {
  const session = await staffSession();
  assertCanManagePlaces(session.profile.role);
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "NO_FILE" as const, rows: [] as PlaceImportRow[] };
  const text = await file.text();
  const table = parseCsv(text);
  if (table.length < 2) return { error: "EMPTY" as const, rows: [] as PlaceImportRow[] };
  const header = csvHeaderIndex(table[0] ?? []);
  const required = ["name", "latitude", "longitude"] as const;
  for (const key of required) {
    if (header[key] == null) return { error: "HEADER" as const, rows: [{ line: 1, error: `Thiếu cột ${key}` }] };
  }
  const allowed: PlaceStatus[] = ["active", "draft", "hidden", "archived", "pending"];
  const rows = [];
  for (let i = 1; i < table.length; i++) {
    const cells = table[i] ?? [];
    const get = (key: string) => cells[header[key]]?.trim() ?? "";
    const name = get("name");
    const lat = Number(get("latitude"));
    const lng = Number(get("longitude"));
    const statusRaw = get("status") || "draft";
    rows.push({
      line: i + 1,
      name,
      slug: slugify(get("slug") || name),
      latitude: lat,
      longitude: lng,
      shortDescription: get("short_description") || undefined,
      address: get("address") || undefined,
      district: get("district") || undefined,
      city: get("city") || undefined,
      phone: get("phone") || undefined,
      website: get("website") || undefined,
      status: (allowed.includes(statusRaw as PlaceStatus) ? statusRaw : "draft") as (typeof allowed)[number],
      externalProvider: get("external_provider") || undefined,
      externalProviderId: get("external_provider_id") || undefined,
    });
  }
  const result = await convexAction(api.imports.commit, { rows });
  revalidatePath("/admin/places");
  return { rows: result.results };
}

export async function adminRunSeed() {
  const session = await requireUser();
  assertAdmin(session.profile.role);
  await convexMutation(api.seed.runAuthorized, {});
  revalidatePath("/home");
  revalidatePath("/explore");
  revalidatePath("/admin");
}

export { isOwner };
