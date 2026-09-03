"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { rateLimit } from "@/lib/security/rate-limit";

export async function exportMyDataAction() {
  const { user, profile } = await requireUser();
  if (!rateLimit(`export:${user.id}`, 3, 60 * 60_000)) return { error: "RATE_LIMIT" as const };
  const supabase = await createServerSupabase();
  const [{ data: posts }, { data: comments }] = await Promise.all([
    supabase.from("experience_posts").select("id, caption, created_at, status").eq("author_id", user.id),
    supabase.from("comments").select("id, body, created_at").eq("author_id", user.id).limit(500),
  ]);
  return {
    ok: true as const,
    payload: {
      exported_at: new Date().toISOString(),
      profile: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        bio: profile.bio,
        created_at: profile.created_at,
      },
      posts: posts ?? [],
      comments: comments ?? [],
    },
  };
}

export async function requestAccountDeletionAction(formData: FormData) {
  const { user, profile } = await requireUser();
  const confirm = String(formData.get("confirm") ?? "");
  if (confirm !== profile.username) return { error: "CONFIRM" as const };
  const password = String(formData.get("password") ?? "");
  const supabase = await createServerSupabase();
  if (user.email && password) {
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
    if (error) return { error: "CURRENT" as const };
  }
  const stamp = new Date().toISOString();
  await supabase
    .from("profiles")
    .update({
      deleted_at: stamp,
      deletion_requested_at: stamp,
      display_name: "Tài khoản đã ẩn",
      bio: null,
      avatar_path: null,
      show_activity_status: false,
    })
    .eq("id", user.id);
  await writeAuditLog({
    actorId: user.id,
    action: "account_deletion_requested",
    targetType: "user",
    targetId: user.id,
  });
  try {
    const admin = createAdminClient();
    await admin.auth.admin.signOut(user.id, "global");
  } catch {
    await supabase.auth.signOut({ scope: "global" });
  }
  redirect("/home");
}
