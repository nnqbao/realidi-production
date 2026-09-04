"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { applyAuthTokens, convexAction, convexMutation, convexQuery, convexToken } from "@/lib/convex/server";
import { convexErrorCode, loginErrorCode } from "@/lib/convex/result";
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
import { getSessionUser, requireUser } from "@/lib/auth/session";
import { safeReturnPath } from "@/lib/auth/return-to";
import { gateMessage, normalizeEmail } from "@/lib/auth/account";
import type { VisitContext } from "@/types/database";

const GENERIC_LOGIN = "INVALID_CREDENTIALS";

async function track(
  eventName: string,
  properties: Record<string, string | number | boolean | null | undefined> = {},
) {
  try {
    await recordProductEvent(eventName, properties);
  } catch {
    // Product analytics still writes through the leftover Supabase path.
  }
}

async function signInWithPasswordProvider(params: Record<string, string>) {
  return await convexAction(api.auth.signIn, {
    provider: "password",
    params,
  });
}

export async function checkUsernameAvailable(username: string) {
  const parsed = usernameSchema.safeParse(normalizeUsername(username));
  if (!parsed.success) return { available: false, reason: "INVALID" as const };
  const token = await convexToken();
  const result = await convexQuery(
    api.profiles.usernameAvailable,
    { username: parsed.data },
    token,
  );
  return { available: result.available, reason: result.available ? ("OK" as const) : ("TAKEN" as const) };
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

  const taken = await convexQuery(api.profiles.usernameAvailable, {
    username: parsed.data.username,
  });
  if (!taken.available) return { error: "USERNAME_TAKEN" as const };

  await track("signup_started");
  try {
    await signInWithPasswordProvider({
      flow: "signUp",
      email: parsed.data.email,
      password: parsed.data.password,
      name: parsed.data.displayName,
      username: parsed.data.username,
    });
  } catch {
    return { error: "GENERIC" as const };
  }
  await track("signup_completed");
  return { needsEmail: true as const, email: parsed.data.email };
}

export async function verifyEmailAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const code = String(formData.get("code") ?? "").trim();
  if (!email || !/^\d{8}$/.test(code)) return { error: "INVALID" as const };
  try {
    const result = await signInWithPasswordProvider({
      flow: "email-verification",
      email,
      code,
    });
    await applyAuthTokens(result.tokens);
  } catch {
    return { error: "INVALID" as const };
  }
  redirect("/onboarding");
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: normalizeEmail(String(formData.get("email") ?? "")),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: GENERIC_LOGIN };
  if (!rateLimit(`login:${parsed.data.email}`, 12, 10 * 60_000)) return { error: "RATE_LIMIT" as const };

  try {
    const result = await signInWithPasswordProvider({
      flow: "signIn",
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (!result.tokens) {
      await track("login_failed");
      return { error: GENERIC_LOGIN };
    }
    await applyAuthTokens(result.tokens);
  } catch (error) {
    await track("login_failed");
    return { error: loginErrorCode(error) };
  }

  await track("login_succeeded");
  redirect(safeReturnPath(formData.get("next"), "/home"));
}

export async function logoutAction() {
  try {
    await convexAction(api.auth.signOut, {});
  } catch {
    // Clear cookies even if the session is already gone.
  }
  await applyAuthTokens(null);
  redirect("/home");
}

export async function logoutOthersAction() {
  await convexAction(api.sessions.revokeOthers, {});
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function logoutAllAction() {
  try {
    await convexAction(api.sessions.revokeAll, {});
  } catch {
    // Still drop the local cookies.
  }
  await applyAuthTokens(null);
  redirect("/login");
}

export async function resetPasswordAction(formData: FormData) {
  const parsed = resetPasswordSchema.safeParse({
    email: normalizeEmail(String(formData.get("email") ?? "")),
  });
  if (!parsed.success) return { ok: true as const };
  if (!rateLimit(`reset:${parsed.data.email}`, 3, 15 * 60_000)) return { ok: true as const };
  try {
    await signInWithPasswordProvider({ flow: "reset", email: parsed.data.email });
  } catch {
    // Same success shape for every address.
  }
  await track("password_reset_requested");
  return { ok: true as const };
}

export async function updatePasswordAction(formData: FormData) {
  const parsed = updatePasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: "INVALID" as const };
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (confirm && confirm !== parsed.data.password) return { error: "MISMATCH" as const };
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const code = String(formData.get("code") ?? "").trim();
  if (!email || !/^\d{8}$/.test(code)) return { error: "INVALID" as const };
  try {
    const result = await signInWithPasswordProvider({
      flow: "reset-verification",
      email,
      code,
      newPassword: parsed.data.password,
    });
    await applyAuthTokens(result.tokens);
  } catch {
    return { error: "INVALID" as const };
  }
  await track("password_reset_completed");
  redirect("/settings?password=updated");
}

export async function resendVerificationAction(email?: string) {
  const normalized = normalizeEmail(email ?? "");
  const session = await getSessionUser().catch(() => null);
  const target = normalized || session?.user.email || "";
  if (!target) return { error: "INVALID" as const };
  if (!rateLimit(`verify:${target}`, 3, 15 * 60_000)) return { error: "RATE_LIMIT" as const };
  try {
    await signInWithPasswordProvider({ flow: "email-verification", email: target });
  } catch {
    // Same success shape whether or not the address exists.
  }
  return { ok: true as const };
}

export async function changePasswordAction(formData: FormData) {
  await requireUser();
  const current = String(formData.get("currentPassword") ?? "");
  const parsed = updatePasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success || current.length < 1) return { error: "INVALID" as const };
  if (String(formData.get("confirmPassword") ?? "") !== parsed.data.password) {
    return { error: "MISMATCH" as const };
  }
  try {
    await convexAction(api.account.changePassword, {
      currentPassword: current,
      newPassword: parsed.data.password,
      signOutOtherSessions: formData.get("signOutOthers") === "on",
    });
  } catch (error) {
    const code = convexErrorCode(error);
    if (code === "INVALID_CREDENTIALS") return { error: "CURRENT" as const };
    return { error: "INVALID" as const };
  }
  revalidatePath("/settings");
  return { ok: true as const };
}

export { gateMessage };

export async function getEditableProfile() {
  const session = await requireUser();
  if (!session.profile.username.trim()) return { error: "NO_USERNAME" as const };
  return {
    ok: true as const,
    profile: {
      displayName: session.profile.display_name,
      username: session.profile.username,
      bio: session.profile.bio ?? "",
    },
  };
}

export async function updateProfileAction(formData: FormData) {
  const { profile } = await requireUser();
  const username = normalizeUsername(
    String(formData.get(PROFILE_USERNAME_FIELD) ?? formData.get("username") ?? ""),
  );
  if (!username) return { error: "USERNAME_REQUIRED" as const };
  const parsed = profileUpdateSchema.safeParse({
    displayName: String(formData.get("displayName") ?? "").trim(),
    username,
    bio: String(formData.get("bio") ?? "").trim() || null,
  });
  if (!parsed.success) return { error: "INVALID" as const };
  try {
    await convexMutation(api.profiles.edit, {
      username: parsed.data.username,
      displayName: parsed.data.displayName,
      bio: parsed.data.bio ?? undefined,
    });
  } catch (error) {
    if (convexErrorCode(error) === "USERNAME_TAKEN") return { error: "USERNAME_TAKEN" as const };
    return { error: "INVALID" as const };
  }
  revalidatePath("/", "layout");
  revalidatePath("/profile/edit");
  revalidatePath("/settings");
  revalidatePath("/me");
  revalidatePath(`/user/${profile.username}`);
  revalidatePath(`/user/${parsed.data.username}`);
  return { ok: true as const, username: parsed.data.username };
}

export async function completeOnboardingAction(input: unknown) {
  await requireUser();
  const body = input as {
    desiredMoodIds?: string[];
    styleIds?: string[];
    visitContexts?: string[];
    budgetMax?: number;
    timeMinutes?: number;
  };
  await convexMutation(api.profiles.completeOnboarding, {
    preferredMoodIds: (body.desiredMoodIds ?? []) as Id<"moods">[],
    preferredStyleIds: (body.styleIds ?? []) as Id<"experience_styles">[],
    preferredVisitContexts: (body.visitContexts ?? []) as VisitContext[],
    budgetMax: body.budgetMax,
    typicalTimeMinutes: body.timeMinutes,
  });
  await track("onboarding_completed", {
    mood_count: body.desiredMoodIds?.length ?? 0,
  });
  redirect("/home");
}

export async function skipOnboardingAction() {
  await requireUser();
  await convexMutation(api.profiles.skipOnboarding, {});
  await track("onboarding_skipped");
  redirect("/home");
}
