import {
  getAuthSessionId,
  getAuthUserId,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { appendAudit } from "./_lib/audit";
import { fail } from "./_lib/errors";
import { isSuspended } from "./_lib/time";
import { normalizeEmail } from "./authLockout";
import { provisionProfile } from "./profiles";
import {
  PASSWORD_POLICY_ERROR,
  PASSWORD_PROVIDER,
  validatePasswordRequirements,
} from "./_providers/Password";

/**
 * Resolves the facts a password change needs from an action, where `ctx.db` is
 * unavailable. Internal-only: the caller supplies an auth user ID that it
 * derived from the session, never from a client argument.
 */
export const credentialContext = internalQuery({
  args: { authUserId: v.id("users") },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", args.authUserId).eq("provider", PASSWORD_PROVIDER))
      .unique();
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_auth_user", (q) => q.eq("auth_user_id", args.authUserId))
      .unique();
    const now = Date.now();
    return {
      email: account?.providerAccountId ?? null,
      profileId: profile?._id ?? null,
      username: profile?.username ?? null,
      active:
        profile !== null &&
        profile.deleted_at === undefined &&
        profile.banned_at === undefined &&
        !isSuspended(now, profile.suspended_at, profile.suspension_ends_at),
    };
  },
});

export const recordPasswordChange = internalMutation({
  args: {
    profileId: v.union(v.id("profiles"), v.null()),
    signedOutOthers: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    if (args.profileId !== null) {
      await ctx.db.patch(args.profileId, {
        must_change_password: false,
        updated_at: now,
      });
    }
    await appendAudit(ctx, {
      ...(args.profileId === null ? {} : { actor_id: args.profileId }),
      action: "account.password_changed",
      target_type: "profile",
      ...(args.profileId === null ? {} : { target_id: args.profileId }),
      after: { signed_out_other_sessions: args.signedOutOthers },
      created_at: now,
    });
  },
});

/**
 * Changes the password of the signed-in account after re-proving the current
 * one. Re-authentication is what stops a stolen session from taking over an
 * account, so it is required even though the caller is already authenticated.
 */
export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
    signOutOtherSessions: v.boolean(),
  },
  handler: async (ctx, args) => {
    const authUserId = await getAuthUserId(ctx);
    if (authUserId === null) fail("UNAUTHENTICATED", "Authentication required");
    const sessionId = await getAuthSessionId(ctx);

    const context = await ctx.runQuery(internal.account.credentialContext, {
      authUserId,
    });
    if (!context.active) fail("ACCOUNT_INACTIVE", "Account is not active");
    if (context.email === null) {
      fail("INVALID_CREDENTIALS", "This account has no password sign-in");
    }

    try {
      validatePasswordRequirements(args.newPassword);
    } catch {
      fail("INVALID_PASSWORD", PASSWORD_POLICY_ERROR);
    }

    try {
      await retrieveAccount(ctx, {
        provider: PASSWORD_PROVIDER,
        account: { id: context.email, secret: args.currentPassword },
      });
    } catch {
      fail("INVALID_CREDENTIALS", "Current password is incorrect");
    }

    await modifyAccountCredentials(ctx, {
      provider: PASSWORD_PROVIDER,
      account: { id: context.email, secret: args.newPassword },
    });

    if (args.signOutOtherSessions) {
      await invalidateSessions(ctx, {
        userId: authUserId,
        except: sessionId === null ? [] : [sessionId],
      });
    }

    await ctx.runMutation(internal.account.recordPasswordChange, {
      profileId: context.profileId as Id<"profiles"> | null,
      signedOutOthers: args.signOutOtherSessions,
    });

    return { ok: true as const, signedOutOtherSessions: args.signOutOtherSessions };
  },
});

export const applyDeletion = internalMutation({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (profile === null) fail("PROFILE_NOT_FOUND", "Profile not found");
    const now = Date.now();
    await ctx.db.patch(args.profileId, {
      deleted_at: now,
      deletion_requested_at: now,
      display_name: "Tài khoản đã ẩn",
      bio: undefined,
      avatar_storage_id: undefined,
      show_activity_status: false,
      updated_at: now,
    });
    await appendAudit(ctx, {
      actor_id: args.profileId,
      action: "account.deletion_requested",
      target_type: "profile",
      target_id: args.profileId,
      created_at: now,
    });
  },
});

/**
 * Soft-deletes the signed-in profile after re-proving the password, then
 * invalidates every session so the client cannot keep using the account.
 */
export const requestDeletion = action({
  args: { confirmUsername: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const authUserId = await getAuthUserId(ctx);
    if (authUserId === null) fail("UNAUTHENTICATED", "Authentication required");

    const context = await ctx.runQuery(internal.account.credentialContext, {
      authUserId,
    });
    if (!context.active || context.profileId === null || context.email === null) {
      fail("ACCOUNT_INACTIVE", "Account is not active");
    }
    if (context.username !== args.confirmUsername) {
      fail("VALIDATION_FAILED", "Username confirmation does not match");
    }

    try {
      await retrieveAccount(ctx, {
        provider: PASSWORD_PROVIDER,
        account: { id: context.email, secret: args.password },
      });
    } catch {
      fail("INVALID_CREDENTIALS", "Current password is incorrect");
    }

    await ctx.runMutation(internal.account.applyDeletion, {
      profileId: context.profileId as Id<"profiles">,
    });
    await invalidateSessions(ctx, { userId: authUserId });
    return { ok: true as const };
  },
});

/**
 * CLI-only: create or update a verified owner/admin and require a password
 * change on the next product or admin action. The secret is a Scrypt hash,
 * never the plaintext password.
 */
export const applyBootstrapOwner = internalMutation({
  args: {
    email: v.string(),
    secret: v.string(),
    displayName: v.optional(v.string()),
    role: v.optional(v.union(v.literal("owner"), v.literal("admin"))),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const now = Date.now();
    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();

    let authUserId = existingUser?._id;
    if (authUserId === undefined) {
      authUserId = await ctx.db.insert("users", {
        email,
        emailVerificationTime: now,
        ...(args.displayName === undefined ? {} : { name: args.displayName }),
      });
      await ctx.db.insert("authAccounts", {
        userId: authUserId,
        provider: PASSWORD_PROVIDER,
        providerAccountId: email,
        secret: args.secret,
        emailVerified: email,
      });
    } else {
      if (existingUser!.emailVerificationTime === undefined) {
        await ctx.db.patch(authUserId, { emailVerificationTime: now });
      }
      const account = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", authUserId!).eq("provider", PASSWORD_PROVIDER))
        .unique();
      if (account === null) {
        await ctx.db.insert("authAccounts", {
          userId: authUserId,
          provider: PASSWORD_PROVIDER,
          providerAccountId: email,
          secret: args.secret,
          emailVerified: email,
        });
      } else {
        await ctx.db.patch(account._id, {
          secret: args.secret,
          emailVerified: email,
        });
      }
    }

    const profile = await provisionProfile(ctx, {
      authUserId,
      email,
      name: args.displayName,
      now,
    });
    const role = args.role ?? "owner";
    if (profile.role === "owner" && role !== "owner") {
      fail("FORBIDDEN", "Cannot demote an owner via bootstrap");
    }
    const beforeRole = profile.role;
    await ctx.db.patch(profile._id, {
      role,
      must_change_password: true,
      onboarding_completed_at: profile.onboarding_completed_at ?? now,
      updated_at: now,
    });
    await appendAudit(ctx, {
      actor_id: profile._id,
      action: role === "owner" ? "owner.provision" : "admin.provision",
      target_type: "profile",
      target_id: profile._id,
      before: { role: beforeRole },
      after: { role, must_change_password: true },
      created_at: now,
    });
    return {
      profileId: profile._id,
      created: existingUser === null,
      role,
      mustChangePassword: true,
    };
  },
});
