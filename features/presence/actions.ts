"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { recordProductEvent } from "@/features/social/actions";
import { LAST_ACTIVE_PING_MS } from "./types";

export async function pingLastActive() {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("profiles").select("last_active_at").eq("id", user.id).maybeSingle();
  if (data?.last_active_at && Date.now() - new Date(data.last_active_at).getTime() < LAST_ACTIVE_PING_MS) {
    return;
  }
  const now = new Date().toISOString();
  await supabase.from("profiles").update({ last_seen_at: now, last_active_at: now }).eq("id", user.id);
}

export async function setShowActivityStatus(enabled: boolean) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("profiles").update({ show_activity_status: enabled }).eq("id", user.id);
  if (error) return { error: error.message, enabled: !enabled };
  await recordProductEvent(enabled ? "activity_status_enabled" : "activity_status_disabled");
  return { enabled };
}
