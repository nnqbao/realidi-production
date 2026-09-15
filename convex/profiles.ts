import type { GenericId } from "convex/values";
import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  optionalIdentity,
  requireIdentity,
  requireVerifiedProfile,
} from "./_lib/authz";
import { appendAudit } from "./_lib/audit";
import { invariant } from "./_lib/errors";
import { isSuspended } from "./_lib/time";
import { normalizeEmail } from "./authLockout";
import { crowdLevel, visitContext } from "./validators";

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, USERNAME_MAX);
}

function assertUsername(username: string): void {
  invariant(
    username.length >= USERNAME_MIN &&
      username.length <= USERNAME_MAX &&
      /^[a-z0-9_]+$/.test(username),
    "INVALID_USERNAME",
    "Username must be 3-30 lowercase letters, numbers, or underscores",
  );
}

async function uniqueUsername(
  ctx: MutationCtx,
  requested: string,
  exclude?: Id<"profiles">,
): Promise<string> {
  const base = normalizeUsername(requested) || "realidi_user";
  for (let suffix = 0; suffix < 10_000; suffix += 1) {
    const ending = suffix === 0 ? "" : `_${suffix}`;
    const candidate = `${base.slice(0, USERNAME_MAX - ending.length)}${ending}`;
    const existing = await ctx.db.query("profiles")
      .withIndex("by_username", (q) => q.eq("username", candidate))
      .unique();
    if (existing === null || existing._id === exclude) return candidate;
  }
  throw new Error("Could not allocate a unique username");
}

async function maybeBootstrapOwner(
  ctx: MutationCtx,
  profile: Doc<"profiles">,
  email: string,
  now: number,
): Promise<Doc<"profiles">> {
  const configured = process.env.INITIAL_OWNER_EMAIL;
  if (
    !configured ||
    normalizeEmail(configured) !== normalizeEmail(email) ||
    profile.role === "owner"
  ) {
    return profile;
  }
  const existingOwner = await ctx.db.query("profiles")
    .withIndex("by_role", (q) => q.eq("role", "owner"))
    .filter((q) => q.eq(q.field("deleted_at"), undefined))
    .first();
  if (existingOwner !== null) return profile;

  await ctx.db.patch(profile._id, { role: "owner", updated_at: now });
  await appendAudit(ctx, {
    actor_id: profile._id,
    action: "owner.bootstrap",
    target_type: "profile",
    target_id: profile._id,
    before: { role: profile.role },
    after: { role: "owner" },
    created_at: now,
  });
  return { ...profile, role: "owner", updated_at: now };
}

export async function provisionProfile(
  ctx: MutationCtx,
  args: {
    authUserId: GenericId<"users">;
    email: string;
    name?: string;
    now?: number;
  },
): Promise<Doc<"profiles">> {
  const now = args.now ?? Date.now();
  const email = normalizeEmail(args.email);
  const existing = await ctx.db.query("profiles")
    .withIndex("by_auth_user", (q) => q.eq("auth_user_id", args.authUserId))
    .unique();
  if (existing !== null) {
    return await maybeBootstrapOwner(ctx, existing, email, now);
  }

  const requested = args.name?.trim() || email.split("@")[0] || "realidi_user";
  const username = await uniqueUsername(ctx, requested);
  const profileId = await ctx.db.insert("profiles", {
    auth_user_id: args.authUserId,
    username,
    email_normalized: email,
    display_name: args.name?.trim().slice(0, 80) || username,
    role: "user",
    locale: "vi",
    timezone: "Asia/Ho_Chi_Minh",
    show_activity_status: true,
    created_at: now,
    updated_at: now,
  });
  await ctx.db.insert("user_preferences", {
    user_id: profileId,
    preferred_mood_ids: [],
    preferred_style_ids: [],
    preferred_visit_contexts: [],
    created_at: now,
    updated_at: now,
  });
  await ctx.db.insert("saved_collections", {
    user_id: profileId,
    name: "Đã lưu",
    slug: "saved",
    user_slug_key: `${profileId}:saved`,
    is_default: true,
    created_at: now,
    updated_at: now,
  });
  const profile = (await ctx.db.get(profileId))!;
  return await maybeBootstrapOwner(ctx, profile, email, now);
}

function gateFor(profile: Doc<"profiles">, verified: boolean, now: number) {
  if (profile.deleted_at !== undefined) return "deleted" as const;
  if (profile.banned_at !== undefined) return "banned" as const;
  if (isSuspended(now, profile.suspended_at, profile.suspension_ends_at)) {
    return "suspended" as const;
  }
  if (!verified) return "unverified" as const;
  return "ok" as const;
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await optionalIdentity(ctx);
    if (identity === null) return null;
    const profile = await ctx.db.get(identity.profile._id as Id<"profiles">);
    const user = await ctx.db.get(identity.authUserId as Id<"users">);
    if (profile === null || user === null) return null;
    return {
      id: profile._id,
      username: profile.username,
      displayName: profile.display_name,
      bio: profile.bio,
      role: profile.role,
      locale: profile.locale,
      timezone: profile.timezone,
      homeCity: profile.home_city,
      showActivityStatus: profile.show_activity_status,
      onboardingCompletedAt: profile.onboarding_completed_at,
      onboardingSkippedAt: profile.onboarding_skipped_at,
      email: profile.email_normalized,
      emailVerified: user.emailVerificationTime !== undefined,
      mustChangePassword: profile.must_change_password === true,
      gate: gateFor(profile, user.emailVerificationTime !== undefined, Date.now()),
      avatarUrl:
        profile.avatar_storage_id === undefined
          ? null
          : await ctx.storage.getUrl(profile.avatar_storage_id),
      createdAt: profile.created_at,
    };
  },
});

/**
 * Applies the username chosen on the signup form after the auth user and
 * default profile already exist. A taken name is left as the generated one
 * so registration itself cannot fail in a way that reveals an existing user.
 */
export const claimSignupUsername = internalMutation({
  args: {
    authUserId: v.id("users"),
    username: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_auth_user", (q) => q.eq("auth_user_id", args.authUserId))
      .unique();
    if (profile === null) return;
    const username = normalizeUsername(args.username);
    if (username.length < USERNAME_MIN || !/^[a-z0-9_]+$/.test(username)) return;
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    const patch: Partial<Doc<"profiles">> = { updated_at: Date.now() };
    if (existing === null || existing._id === profile._id) {
      patch.username = username;
    }
    if (args.displayName !== undefined) {
      const value = args.displayName.trim().slice(0, 80);
      if (value.length >= 1) patch.display_name = value;
    }
    await ctx.db.patch(profile._id, patch);
  },
});

export const onboardingCatalog = query({
  args: {},
  handler: async (ctx) => {
    const [currentStates, desired, styles] = await Promise.all([
      ctx.db
        .query("moods")
        .withIndex("by_layer_active_order", (q) =>
          q.eq("layer", "current_state").eq("is_active", true))
        .collect(),
      ctx.db
        .query("moods")
        .withIndex("by_layer_active_order", (q) =>
          q.eq("layer", "desired_feeling").eq("is_active", true))
        .collect(),
      ctx.db
        .query("experience_styles")
        .withIndex("by_active_order", (q) => q.eq("is_active", true))
        .collect(),
    ]);
    return {
      currentStates: currentStates.map((row) => ({
        id: row._id,
        name_vi: row.name_vi,
        name_en: row.name_en,
      })),
      desired: desired.map((row) => ({
        id: row._id,
        name_vi: row.name_vi,
        name_en: row.name_en,
      })),
      styles: styles.map((row) => ({
        id: row._id,
        name_vi: row.name_vi,
        name_en: row.name_en,
      })),
    };
  },
});

export const usernameAvailable = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const username = normalizeUsername(args.username);
    if (username.length < USERNAME_MIN) return { available: false, username };
    const identity = await optionalIdentity(ctx);
    const existing = await ctx.db.query("profiles")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    return {
      username,
      available:
        existing === null ||
        existing._id === (identity?.profile._id as Id<"profiles"> | undefined),
    };
  },
});

export const edit = mutation({
  args: {
    username: v.optional(v.string()),
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    locale: v.optional(v.string()),
    timezone: v.optional(v.string()),
    homeCity: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const profileId = profile._id as Id<"profiles">;
    const patch: Partial<Doc<"profiles">> = { updated_at: Date.now() };
    if (args.username !== undefined) {
      const username = normalizeUsername(args.username);
      assertUsername(username);
      const existing = await ctx.db.query("profiles")
        .withIndex("by_username", (q) => q.eq("username", username))
        .unique();
      invariant(
        existing === null || existing._id === profileId,
        "USERNAME_TAKEN",
        "Username is already taken",
      );
      patch.username = username;
    }
    if (args.displayName !== undefined) {
      const value = args.displayName.trim();
      invariant(
        value.length >= 1 && value.length <= 80,
        "INVALID_DISPLAY_NAME",
        "Display name must be 1-80 characters",
      );
      patch.display_name = value;
    }
    if (args.bio !== undefined) {
      const value = args.bio.trim();
      invariant(value.length <= 500, "INVALID_BIO", "Bio must be at most 500 characters");
      patch.bio = value || undefined;
    }
    if (args.locale !== undefined) {
      invariant(
        ["vi", "en"].includes(args.locale),
        "INVALID_LOCALE",
        "Locale must be vi or en",
      );
      patch.locale = args.locale;
    }
    if (args.timezone !== undefined) {
      invariant(
        args.timezone.length >= 1 && args.timezone.length <= 80,
        "INVALID_TIMEZONE",
        "Timezone must be 1-80 characters",
      );
      patch.timezone = args.timezone;
    }
    if (args.homeCity !== undefined) {
      const value = args.homeCity.trim();
      invariant(
        value.length <= 100,
        "INVALID_HOME_CITY",
        "Home city must be at most 100 characters",
      );
      patch.home_city = value || undefined;
    }
    await ctx.db.patch(profileId, patch);
    return { ok: true };
  },
});

export const completeOnboarding = mutation({
  args: {
    preferredMoodIds: v.array(v.id("moods")),
    preferredStyleIds: v.array(v.id("experience_styles")),
    preferredVisitContexts: v.array(visitContext),
    budgetMin: v.optional(v.number()),
    budgetMax: v.optional(v.number()),
    typicalTimeMinutes: v.optional(v.number()),
    preferredCrowd: v.optional(crowdLevel),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const profileId = profile._id as Id<"profiles">;
    const BUDGET_MESSAGE = "Budget must be a non-negative range";
    for (const id of args.preferredMoodIds) {
      invariant(await ctx.db.get(id), "INVALID_MOOD", "Unknown mood");
    }
    for (const id of args.preferredStyleIds) {
      invariant(await ctx.db.get(id), "INVALID_STYLE", "Unknown experience style");
    }
    if (args.budgetMin !== undefined) {
      invariant(args.budgetMin >= 0, "INVALID_BUDGET", BUDGET_MESSAGE);
    }
    if (args.budgetMax !== undefined) {
      invariant(args.budgetMax >= 0, "INVALID_BUDGET", BUDGET_MESSAGE);
    }
    if (args.budgetMin !== undefined && args.budgetMax !== undefined) {
      invariant(args.budgetMin <= args.budgetMax, "INVALID_BUDGET", BUDGET_MESSAGE);
    }
    if (args.typicalTimeMinutes !== undefined) {
      invariant(
        args.typicalTimeMinutes > 0 && args.typicalTimeMinutes <= 24 * 60,
        "INVALID_DURATION",
        "Typical time must be between 1 minute and 24 hours",
      );
    }
    const preferences = await ctx.db.query("user_preferences")
      .withIndex("by_user", (q) => q.eq("user_id", profileId))
      .unique();
    invariant(
      preferences !== null,
      "PROFILE_NOT_PROVISIONED",
      "Profile preferences are missing",
    );
    const now = Date.now();
    await ctx.db.patch(preferences._id, {
      preferred_mood_ids: [...new Set(args.preferredMoodIds)],
      preferred_style_ids: [...new Set(args.preferredStyleIds)],
      preferred_visit_contexts: [...new Set(args.preferredVisitContexts)],
      budget_min: args.budgetMin,
      budget_max: args.budgetMax,
      typical_time_minutes: args.typicalTimeMinutes,
      preferred_crowd: args.preferredCrowd,
      updated_at: now,
    });
    await ctx.db.patch(profileId, {
      onboarding_completed_at: now,
      onboarding_skipped_at: undefined,
      updated_at: now,
    });
    return { ok: true };
  },
});

export const skipOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const now = Date.now();
    await ctx.db.patch(profile._id as Id<"profiles">, {
      onboarding_skipped_at: now,
      updated_at: now,
    });
    return { ok: true };
  },
});

export const setActivityStatus = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    await ctx.db.patch(profile._id as Id<"profiles">, {
      show_activity_status: args.enabled,
      updated_at: Date.now(),
    });
    return { ok: true };
  },
});

export const publicProfile = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    await optionalIdentity(ctx);
    const profile = await ctx.db.query("profiles")
      .withIndex("by_username", (q) => q.eq("username", normalizeUsername(args.username)))
      .unique();
    if (
      profile === null ||
      profile.deleted_at !== undefined ||
      profile.banned_at !== undefined ||
      isSuspended(Date.now(), profile.suspended_at, profile.suspension_ends_at)
    ) {
      return null;
    }
    return {
      id: profile._id,
      username: profile.username,
      displayName: profile.display_name,
      bio: profile.bio,
      role: profile.role,
      homeCity: profile.home_city,
      avatarUrl:
        profile.avatar_storage_id === undefined
          ? null
          : await ctx.storage.getUrl(profile.avatar_storage_id),
      lastActiveAt: profile.show_activity_status ? profile.last_active_at : undefined,
    };
  },
});

export const preferences = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireIdentity(ctx);
    return await ctx.db.query("user_preferences")
      .withIndex("by_user", (q) => q.eq("user_id", profile._id as Id<"profiles">))
      .unique();
  },
});
