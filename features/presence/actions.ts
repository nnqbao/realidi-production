"use server";

import { api } from "@/convex/_generated/api";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { convexMutation } from "@/lib/convex/server";
import { requireUser } from "@/lib/auth/session";
import { recordProductEvent } from "@/features/social/actions";
import { LAST_ACTIVE_PING_MS } from "./types";

export async function pingLastActive() {
  if (!isSupabaseConfigured()) return;
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
  await requireUser();
  try {
    await convexMutation(api.profiles.setActivityStatus, { enabled });
  } catch {
    return { error: "SAVE_FAILED", enabled: !enabled };
  }
  try {
    await recordProductEvent(enabled ? "activity_status_enabled" : "activity_status_disabled");
  } catch {
    // Analytics is optional during the Convex auth cutover.
  }
  return { enabled };
}
