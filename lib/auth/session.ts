import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Profile } from "@/types/database";
import type { User } from "@supabase/supabase-js";
import { accountGate, type AccountGate } from "./account";
import type { UserRole } from "./roles";

export type SessionUser = {
  user: User;
  profile: Profile;
  gate: AccountGate;
};

async function maybeBootstrapOwner(user: User, profile: Profile): Promise<Profile> {
  const email = process.env.INITIAL_OWNER_EMAIL?.trim().toLowerCase();
  if (!email || user.email?.toLowerCase() !== email) return profile;
  if (profile.role === "owner") return profile;
  try {
    const admin = createAdminClient();
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "owner");
    if ((count ?? 0) > 0) return profile;
    await admin.from("profiles").update({ role: "owner" as UserRole }).eq("id", user.id);
    return { ...profile, role: "owner" };
  } catch {
    return profile;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) return null;
  const nextProfile = await maybeBootstrapOwner(user, profile as Profile);
  const gate = accountGate(nextProfile, Boolean(user.email_confirmed_at));
  if (gate === "deleted" || gate === "banned" || gate === "suspended") {
    await supabase.auth.signOut({ scope: "local" });
    return null;
  }
  return { user, profile: nextProfile, gate };
}

export async function requireUser(): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
}
