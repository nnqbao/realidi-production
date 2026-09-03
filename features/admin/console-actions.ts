"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
import { writeAuditLog } from "@/lib/auth/audit";
import { recordProductEvent } from "@/features/social/actions";
import { revalidatePath } from "next/cache";
import { validateMediaFile } from "@/lib/media";
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
  const supabase = await createServerSupabase();
  const now = Date.now();
  const d7 = new Date(now - 7 * 24 * 60 * 60_000).toISOString();
  const d30 = new Date(now - 30 * 24 * 60 * 60_000).toISOString();
  const [
    users,
    users7,
    users30,
    places,
    placesDraft,
    placesPublished,
    placesHidden,
    posts,
    reportsOpen,
    reportsHigh,
    suspended,
    recent,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", d7),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", d30),
    supabase.from("places").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("places").select("id", { count: "exact", head: true }).in("status", ["pending", "draft"]),
    supabase.from("places").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("places").select("id", { count: "exact", head: true }).eq("status", "hidden"),
    supabase.from("experience_posts").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("reports").select("id", { count: "exact", head: true }).in("status", ["pending", "investigating"]),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("priority", "high").in("status", ["pending", "investigating"]),
    supabase.from("profiles").select("id", { count: "exact", head: true }).not("suspended_at", "is", null).is("banned_at", null),
    supabase.from("audit_logs").select("id, action, target_type, created_at, actor_id").order("created_at", { ascending: false }).limit(8),
  ]);
  return {
    users: users.count ?? 0,
    users7: users7.count ?? 0,
    users30: users30.count ?? 0,
    places: places.count ?? 0,
    placesDraft: placesDraft.count ?? 0,
    placesPublished: placesPublished.count ?? 0,
    placesHidden: placesHidden.count ?? 0,
    posts: posts.count ?? 0,
    reportsOpen: reportsOpen.count ?? 0,
    reportsHigh: reportsHigh.count ?? 0,
    suspended: suspended.count ?? 0,
    recent: recent.data ?? [],
  };
}

export async function adminAssignReport(reportId: string, assigneeId: string | null) {
  const session = await staffSession();
  assertCanModerate(session.profile.role);
  const supabase = await createServerSupabase();
  await supabase
    .from("reports")
    .update({
      assigned_to: assigneeId,
      status: "investigating",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", reportId);
  await writeAuditLog({
    actorId: session.user.id,
    action: "report_assigned",
    targetType: "report",
    targetId: reportId,
    after: { assigned_to: assigneeId },
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
  const supabase = await createServerSupabase();
  const { data: report } = await supabase.from("reports").select("*").eq("id", input.reportId).maybeSingle();
  if (!report) return { error: "NOT_FOUND" as const };
  if (input.hideTarget && (report.target_type === "post" || report.target_type === "comment")) {
    if (report.target_type === "post") {
      await supabase.from("experience_posts").update({ moderation_status: "hidden", status: "hidden" }).eq("id", report.target_id);
    } else {
      await supabase.from("comments").update({ deleted_at: new Date().toISOString(), moderation_status: "removed" }).eq("id", report.target_id);
    }
  }
  const admin = createAdminClient();
  if (input.warnUserId) {
    await admin.from("profiles").update({ warned_at: new Date().toISOString() }).eq("id", input.warnUserId);
  }
  if (input.suspendUserId) {
    const ends = input.suspendHours
      ? new Date(Date.now() + input.suspendHours * 3600_000).toISOString()
      : null;
    await admin.from("profiles").update({ suspended_at: new Date().toISOString(), suspension_ends_at: ends }).eq("id", input.suspendUserId);
    await recordProductEvent("admin_user_suspended", { target_user_id: input.suspendUserId });
  }
  if (input.banUserId) {
    await admin.from("profiles").update({ banned_at: new Date().toISOString(), ban_reason: input.reason }).eq("id", input.banUserId);
    try {
      await admin.auth.admin.signOut(input.banUserId, "global");
    } catch {
      /* auth admin may be unavailable locally */
    }
  }
  await supabase.from("reports").update({
    status: input.decision,
    resolved_by: session.user.id,
    resolved_at: new Date().toISOString(),
    reviewed_at: new Date().toISOString(),
  }).eq("id", input.reportId);
  await writeAuditLog({
    actorId: session.user.id,
    action: "admin_report_actioned",
    targetType: "report",
    targetId: input.reportId,
    reason: input.reason,
    after: { decision: input.decision, hideTarget: input.hideTarget },
  });
  await recordProductEvent("admin_report_actioned", { report_id: input.reportId });
  revalidatePath("/admin/reports");
  return { ok: true as const };
}

export async function adminChangeRole(userId: string, role: UserRole, reason: string) {
  const session = await requireUser();
  assertAdmin(session.profile.role);
  if (!canAssignRoles(session.profile.role, role)) return { error: "FORBIDDEN_ROLE" as const };
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id, role").eq("id", userId).maybeSingle();
  if (!target) return { error: "NOT_FOUND" as const };
  if (target.role === "owner" && role !== "owner") {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "owner");
    if ((count ?? 0) <= 1) return { error: "LAST_OWNER" as const };
  }
  await admin.from("profiles").update({ role }).eq("id", userId);
  await writeAuditLog({
    actorId: session.user.id,
    action: "set_role",
    targetType: "user",
    targetId: userId,
    before: { role: target.role },
    after: { role },
    reason,
  });
  revalidatePath("/admin/users");
  return { ok: true as const };
}

export async function adminSetUserStatus(input: {
  userId: string;
  action: "suspend" | "unsuspend" | "ban" | "restore";
  reason: string;
  hours?: number | null;
}) {
  const session = await requireUser();
  assertAdmin(session.profile.role);
  if (!input.reason.trim() && input.action !== "unsuspend" && input.action !== "restore") {
    return { error: "REASON_REQUIRED" as const };
  }
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id, role").eq("id", input.userId).maybeSingle();
  if (target?.role === "owner" && input.action === "ban") return { error: "LAST_OWNER" as const };
  const now = new Date().toISOString();
  if (input.action === "suspend") {
    await admin.from("profiles").update({
      suspended_at: now,
      suspension_ends_at: input.hours ? new Date(Date.now() + input.hours * 3600_000).toISOString() : null,
    }).eq("id", input.userId);
  }
  if (input.action === "unsuspend") {
    await admin.from("profiles").update({ suspended_at: null, suspension_ends_at: null }).eq("id", input.userId);
  }
  if (input.action === "ban") {
    await admin.from("profiles").update({ banned_at: now, ban_reason: input.reason }).eq("id", input.userId);
    try {
      await admin.auth.admin.signOut(input.userId, "global");
    } catch {
      /* ignore */
    }
  }
  if (input.action === "restore") {
    await admin.from("profiles").update({ banned_at: null, ban_reason: null, suspended_at: null, suspension_ends_at: null }).eq("id", input.userId);
  }
  await writeAuditLog({
    actorId: session.user.id,
    action: `user_${input.action}`,
    targetType: "user",
    targetId: input.userId,
    reason: input.reason,
  });
  if (input.action === "suspend") await recordProductEvent("admin_user_suspended", { target_user_id: input.userId });
  revalidatePath("/admin/users");
  return { ok: true as const };
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
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${placeId}/${crypto.randomUUID()}.${ext}`;
  const supabase = await createServerSupabase();
  const { error } = await supabase.storage.from("place-media").upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: error.message };
  const alt = String(formData.get("alt") ?? "").slice(0, 180);
  await supabase.from("place_media").insert({
    place_id: placeId,
    storage_path: path,
    alt_text: alt || null,
    created_by: session.user.id,
  });
  const cover = formData.get("cover") === "on";
  if (cover) {
    await supabase.from("places").update({ cover_image_path: path, updated_by: session.user.id }).eq("id", placeId);
  }
  await writeAuditLog({
    actorId: session.user.id,
    action: "place_media_uploaded",
    targetType: "place",
    targetId: placeId,
    after: { path },
  });
  revalidatePath(`/admin/places/${placeId}`);
  return { ok: true as const, path };
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
  const supabase = await createServerSupabase();
  const payload = {
    slug: slugify(input.slug || input.title),
    title: input.title,
    description: input.description ?? null,
    kind: input.kind,
    status: input.status,
    sort_order: input.sortOrder,
    updated_by: session.user.id,
  };
  if (input.id) {
    await supabase.from("editorial_collections").update(payload).eq("id", input.id);
  } else {
    await supabase.from("editorial_collections").insert({ ...payload, created_by: session.user.id });
  }
  await writeAuditLog({
    actorId: session.user.id,
    action: input.id ? "collection_updated" : "collection_created",
    targetType: "collection",
    targetId: input.id ?? null,
    after: payload,
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
  const supabase = await createServerSupabase();
  await supabase.from("featured_placements").insert({
    surface: input.surface,
    target_type: input.targetType,
    target_id: input.targetId,
    status: input.status,
    sort_order: input.sortOrder,
    created_by: session.user.id,
    updated_by: session.user.id,
  });
  revalidatePath("/admin/collections");
  return { ok: true as const };
}

export async function adminSetPlaceStatus(placeId: string, status: "active" | "hidden" | "draft" | "archived", reason?: string) {
  const session = await staffSession();
  assertCanManagePlaces(session.profile.role);
  const supabase = await createServerSupabase();
  const extra =
    status === "archived"
      ? { archived_at: new Date().toISOString(), deleted_at: null }
      : status === "active"
        ? { archived_at: null, deleted_at: null }
        : {};
  await supabase.from("places").update({ status, updated_by: session.user.id, ...extra }).eq("id", placeId);
  await writeAuditLog({
    actorId: session.user.id,
    action: `place_${status}`,
    targetType: "place",
    targetId: placeId,
    reason: reason ?? null,
    after: { status },
  });
  if (status === "active") await recordProductEvent("admin_place_published", { place_id: placeId });
  revalidatePath("/admin/places");
  revalidatePath(`/admin/places/${placeId}`);
  return { ok: true as const };
}

export async function adminSoftDeletePlace(placeId: string, reason: string) {
  const session = await staffSession();
  assertCanManagePlaces(session.profile.role);
  const supabase = await createServerSupabase();
  const { count } = await supabase.from("experience_posts").select("id", { count: "exact", head: true }).eq("place_id", placeId);
  await supabase.from("places").update({
    deleted_at: new Date().toISOString(),
    status: "archived",
    updated_by: session.user.id,
  }).eq("id", placeId);
  await writeAuditLog({
    actorId: session.user.id,
    action: "place_soft_deleted",
    targetType: "place",
    targetId: placeId,
    reason,
    after: { referenced_posts: count ?? 0 },
  });
  revalidatePath("/admin/places");
  return { ok: true as const };
}

export async function adminRestorePlace(placeId: string) {
  const session = await staffSession();
  assertCanManagePlaces(session.profile.role);
  const supabase = await createServerSupabase();
  await supabase.from("places").update({
    deleted_at: null,
    archived_at: null,
    status: "draft",
    updated_by: session.user.id,
  }).eq("id", placeId);
  await writeAuditLog({
    actorId: session.user.id,
    action: "place_restored",
    targetType: "place",
    targetId: placeId,
  });
  revalidatePath("/admin/places");
  return { ok: true as const };
}

export async function adminImportPlacesCsv(formData: FormData) {
  const session = await staffSession();
  assertCanManagePlaces(session.profile.role);
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "NO_FILE" as const, rows: [] as PlaceImportRow[] };
  const text = await file.text();
  const { parseCsv, csvHeaderIndex } = await import("@/lib/csv");
  const table = parseCsv(text);
  if (table.length < 2) return { error: "EMPTY" as const, rows: [] as PlaceImportRow[] };
  const header = csvHeaderIndex(table[0] ?? []);
  const required = ["name", "latitude", "longitude"] as const;
  for (const key of required) {
    if (header[key] == null) return { error: "HEADER" as const, rows: [{ line: 1, error: `Thiếu cột ${key}` }] as PlaceImportRow[] };
  }
  const supabase = await createServerSupabase();
  const results: PlaceImportRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const cells = table[i] ?? [];
    const get = (key: string) => cells[header[key]]?.trim() ?? "";
    const name = get("name");
    const lat = Number(get("latitude"));
    const lng = Number(get("longitude"));
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      results.push({ line: i + 1, error: "Thiếu tên hoặc tọa độ không hợp lệ." });
      continue;
    }
    const slug = slugify(get("slug") || name);
    const { data: existing } = await supabase.from("places").select("id").eq("slug", slug).maybeSingle();
    if (existing) {
      results.push({ line: i + 1, skipped: `Slug đã tồn tại: ${slug}` });
      continue;
    }
    const statusRaw = get("status") || "draft";
    const allowed: PlaceStatus[] = ["active", "draft", "hidden", "archived", "pending"];
    const status: PlaceStatus = allowed.includes(statusRaw as PlaceStatus) ? (statusRaw as PlaceStatus) : "draft";
    const { error } = await supabase.from("places").insert({
      name,
      slug,
      short_description: get("short_description") || null,
      address: get("address") || null,
      district: get("district") || null,
      city: get("city") || "TP. Hồ Chí Minh",
      latitude: lat,
      longitude: lng,
      phone: get("phone") || null,
      website: get("website") || null,
      editorial_score: 0.5,
      admin_quality_score: 0.5,
      status,
      source: "editorial",
      verified_by_admin: true,
      created_by: session.user.id,
      updated_by: session.user.id,
    });
    if (error) results.push({ line: i + 1, error: error.message });
    else results.push({ line: i + 1, ok: true });
  }
  await writeAuditLog({
    actorId: session.user.id,
    action: "place_csv_import",
    targetType: "place",
    after: { imported: results.filter((r) => r.ok).length, failed: results.filter((r) => r.error).length },
  });
  revalidatePath("/admin/places");
  return { rows: results };
}

export { isOwner };
