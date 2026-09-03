"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  loginSchema,
  profileUpdateSchema,
  resetPasswordSchema,
  signUpSchema,
  usernameSchema,
  normalizeUsername,
  updatePasswordSchema,
} from "@/lib/validation";
import { PROFILE_USERNAME_FIELD } from "@/features/profile/edit-state";
import { rateLimit } from "@/lib/security/rate-limit";
import { recordProductEvent } from "@/features/social/actions";
import { onboardingSchema } from "@/lib/validation";
import { getSessionUser, requireUser } from "@/lib/auth/session";
import { safeReturnPath } from "@/lib/auth/return-to";
import { accountGate, gateMessage, normalizeEmail } from "@/lib/auth/account";
import { clearLoginFailures, getLockout, recordLoginFailure } from "@/lib/auth/lockout";
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/cookies";
import type { Profile } from "@/types/database";

const GENERIC_LOGIN = "INVALID_CREDENTIALS";

export async function checkUsernameAvailable(username: string) {
  const parsed = usernameSchema.safeParse(normalizeUsername(username));
  if (!parsed.success) return { available: false, reason: "INVALID" as const };
  const supabase = await createServerSupabase();
  const session = await getSessionUser().catch(() => null);
  let query = supabase.from("profiles").select("id").eq("username", parsed.data);
  if (session) query = query.neq("id", session.user.id);
  const { data } = await query.maybeSingle();
  return { available: !data, reason: data ? ("TAKEN" as const) : ("OK" as const) };
}

export async function signUpAction(formData: FormData) {
  if (formData.get("terms") !== "on") return { error: "TERMS" as const };
  const parsed = signUpSchema.safeParse({
    email: normalizeEmail(String(formData.get("email") ?? "")),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    displayName: String(formData.get("displayName") ?? "").trim(),
    username: normalizeUsername(String(formData.get("username") ?? "")),
  });
  if (!parsed.success) return { error: "INVALID" as const };
  if (!rateLimit(`signup:${parsed.data.email}`, 5, 15 * 60_000)) return { error: "RATE_LIMIT" as const };

  const supabase = await createServerSupabase();
  const taken = await supabase.from("profiles").select("id").eq("username", parsed.data.username).maybeSingle();
  if (taken.data) return { error: "USERNAME_TAKEN" as const };
  await recordProductEvent("signup_started", {});
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        username: parsed.data.username,
        display_name: parsed.data.displayName,
        locale: "vi",
      },
      emailRedirectTo: `${appUrl}/auth/callback?next=/onboarding`,
    },
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
      return { error: "GENERIC" as const };
    }
    return { error: "GENERIC" as const };
  }
  await recordProductEvent("signup_completed", {});
  if (!data.session) return { needsEmail: true as const, email: parsed.data.email };
  redirect("/onboarding");
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: normalizeEmail(String(formData.get("email") ?? "")),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: GENERIC_LOGIN };
  if (!rateLimit(`login:${parsed.data.email}`, 12, 10 * 60_000)) return { error: "RATE_LIMIT" as const };
  const lock = await getLockout(parsed.data.email);
  if (lock.locked) return { error: "LOCKED" as const };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    await recordLoginFailure(parsed.data.email);
    await recordProductEvent("login_failed", {});
    return { error: GENERIC_LOGIN };
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  const gate = accountGate((profile ?? {}) as Profile, Boolean(data.user.email_confirmed_at));
  if (gate === "deleted" || gate === "banned" || gate === "suspended") {
    await supabase.auth.signOut({ scope: "local" });
    await recordProductEvent("login_failed", {});
    return { error: gate };
  }

  await clearLoginFailures(parsed.data.email);
  await recordProductEvent("login_succeeded", {});
  const remember = formData.get("remember") === "on";
  const jar = await cookies();
  jar.set("realidi-remember", remember ? "1" : "0", {
    ...AUTH_COOKIE_OPTIONS,
    httpOnly: true,
    maxAge: remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12,
  });
  redirect(safeReturnPath(formData.get("next"), "/home"));
}

export async function logoutAction() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/home");
}

export async function logoutOthersAction() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut({ scope: "others" });
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function logoutAllAction() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}

export async function resetPasswordAction(formData: FormData) {
  const parsed = resetPasswordSchema.safeParse({ email: normalizeEmail(String(formData.get("email") ?? "")) });
  if (!parsed.success) return { ok: true as const };
  if (!rateLimit(`reset:${parsed.data.email}`, 3, 15 * 60_000)) return { ok: true as const };
  const supabase = await createServerSupabase();
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/auth/callback?next=/reset-password/update`,
  });
  await recordProductEvent("password_reset_requested", {});
  return { ok: true as const };
}

export async function updatePasswordAction(formData: FormData) {
  const parsed = updatePasswordSchema.safeParse({ password: String(formData.get("password") ?? "") });
  if (!parsed.success) return { error: "INVALID" as const };
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (confirm && confirm !== parsed.data.password) return { error: "MISMATCH" as const };
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "INVALID" as const };
  if (formData.get("signOutOthers") === "on") {
    await supabase.auth.signOut({ scope: "others" });
  }
  await recordProductEvent("password_reset_completed", {});
  redirect("/settings?password=updated");
}

export async function resendVerificationAction(email?: string) {
  const normalized = normalizeEmail(email ?? "");
  const session = await getSessionUser().catch(() => null);
  const target = normalized || session?.user.email || "";
  if (!target) return { error: "INVALID" as const };
  if (!rateLimit(`verify:${target}`, 3, 15 * 60_000)) return { error: "RATE_LIMIT" as const };
  const supabase = await createServerSupabase();
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: target,
    options: { emailRedirectTo: `${appUrl}/auth/callback?next=/onboarding` },
  });
  if (error) return { ok: true as const };
  return { ok: true as const };
}

export async function changePasswordAction(formData: FormData) {
  await requireUser();
  const current = String(formData.get("currentPassword") ?? "");
  const parsed = updatePasswordSchema.safeParse({ password: String(formData.get("password") ?? "") });
  if (!parsed.success || current.length < 1) return { error: "INVALID" as const };
  if (String(formData.get("confirmPassword") ?? "") !== parsed.data.password) return { error: "MISMATCH" as const };
  const supabase = await createServerSupabase();
  const session = await requireUser();
  const { error: check } = await supabase.auth.signInWithPassword({
    email: session.user.email ?? "",
    password: current,
  });
  if (check) return { error: "CURRENT" as const };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "INVALID" as const };
  if (formData.get("signOutOthers") === "on") await supabase.auth.signOut({ scope: "others" });
  revalidatePath("/settings");
  return { ok: true as const };
}

export { gateMessage };

export async function getEditableProfile() {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return { error: "LOAD_FAILED" as const };
  if (!data?.username?.trim()) return { error: "NO_USERNAME" as const };
  return {
    ok: true as const,
    profile: {
      displayName: data.display_name,
      username: data.username,
      bio: data.bio ?? "",
    },
  };
}

export async function updateProfileAction(formData: FormData) {
  const { user, profile } = await requireUser();
  const username = normalizeUsername(String(formData.get(PROFILE_USERNAME_FIELD) ?? formData.get("username") ?? ""));
  if (!username) return { error: "USERNAME_REQUIRED" as const };
  const parsed = profileUpdateSchema.safeParse({
    displayName: String(formData.get("displayName") ?? "").trim(),
    username,
    bio: String(formData.get("bio") ?? "").trim() || null,
  });
  if (!parsed.success) return { error: "INVALID" as const };
  const supabase = await createServerSupabase();
  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", parsed.data.username)
    .neq("id", user.id)
    .maybeSingle();
  if (taken) return { error: "USERNAME_TAKEN" as const };
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      username: parsed.data.username,
      bio: parsed.data.bio,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  revalidatePath("/profile/edit");
  revalidatePath("/settings");
  revalidatePath("/me");
  revalidatePath(`/user/${profile.username}`);
  revalidatePath(`/user/${parsed.data.username}`);
  return { ok: true as const, username: parsed.data.username };
}

export async function completeOnboardingAction(input: unknown) {
  const { user } = await requireUser();
  const parsed = onboardingSchema.parse(input);
  const supabase = await createServerSupabase();
  await supabase
    .from("user_preferences")
    .update({
      preferred_mood_ids: parsed.desiredMoodIds,
      preferred_style_ids: parsed.styleIds,
      preferred_visit_contexts: parsed.visitContexts,
      budget_max: parsed.budgetMax ?? null,
      typical_time_minutes: parsed.timeMinutes ?? null,
    })
    .eq("user_id", user.id);
  await supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);
  await recordProductEvent("onboarding_completed", {
    mood_count: parsed.desiredMoodIds.length,
  });
  redirect("/home");
}

export async function skipOnboardingAction() {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  await supabase
    .from("profiles")
    .update({ onboarding_skipped_at: new Date().toISOString() })
    .eq("id", user.id);
  await recordProductEvent("onboarding_skipped", {});
  redirect("/home");
}
