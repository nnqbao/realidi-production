import { api } from "@/convex/_generated/api";
import { isConvexConfigured } from "@/lib/convex/env";
import { convexQuery, convexToken } from "@/lib/convex/server";
import type { Profile } from "@/types/database";
import { accountGate, type AccountGate } from "./account";

export type SessionAuthUser = {
  id: string;
  email: string;
  email_confirmed_at: string | null;
};

export type SessionUser = {
  user: SessionAuthUser;
  profile: Profile;
  gate: AccountGate;
};

function iso(value: number | undefined): string | null {
  return value === undefined ? null : new Date(value).toISOString();
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isConvexConfigured()) return null;
  const token = await convexToken();
  if (!token) return null;
  const current = await convexQuery(api.profiles.current, {}, token);
  if (current === null) return null;
  if (current.gate === "deleted" || current.gate === "banned" || current.gate === "suspended") {
    return null;
  }

  const profile: Profile = {
    id: current.id,
    username: current.username,
    display_name: current.displayName,
    bio: current.bio ?? null,
    avatar_path: current.avatarUrl ?? null,
    role: current.role,
    locale: current.locale,
    timezone: current.timezone,
    home_city: current.homeCity ?? null,
    onboarding_completed_at: iso(current.onboardingCompletedAt),
    onboarding_skipped_at: iso(current.onboardingSkippedAt),
    last_seen_at: null,
    last_active_at: null,
    show_activity_status: current.showActivityStatus,
    created_at: iso(current.createdAt) ?? new Date(0).toISOString(),
    updated_at: iso(current.createdAt) ?? new Date(0).toISOString(),
    deleted_at: null,
    suspended_at: null,
    banned_at: null,
    ban_reason: null,
    suspension_ends_at: null,
    deletion_requested_at: null,
    warned_at: null,
  };

  const gate = accountGate(profile, current.emailVerified);
  return {
    user: {
      id: current.id,
      email: current.email ?? "",
      email_confirmed_at: current.emailVerified ? new Date().toISOString() : null,
    },
    profile,
    gate,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
}
