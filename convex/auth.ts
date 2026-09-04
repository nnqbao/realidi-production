import { convexAuth } from "@convex-dev/auth/server";
import type { GenericMutationCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { isSuspended } from "./_lib/time";
import { ResetPasswordOtp, VerifyEmailOtp } from "./_providers/EmailOtp";
import { Password } from "./_providers/Password";
import { provisionProfile } from "./profiles";

const SESSION_TOTAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_INACTIVE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      reset: ResetPasswordOtp,
      verify: VerifyEmailOtp,
    }),
  ],
  session: {
    totalDurationMs: SESSION_TOTAL_DURATION_MS,
    inactiveDurationMs: SESSION_INACTIVE_DURATION_MS,
  },
  callbacks: {
    /**
     * Runs inside the same transaction that creates or links the auth user, so
     * a registration can never leave a user without a profile, preferences,
     * and a default collection. Idempotent, because the library also calls
     * this after email verification.
     */
    afterUserCreatedOrUpdated: async (ctx, args) => {
      const email = optionalString(args.profile.email);
      if (email === undefined) return;
      await provisionProfile(ctx as unknown as MutationCtx, {
        authUserId: args.userId,
        email,
        name: optionalString(args.profile.name),
      });
    },

    /**
     * The account-state gate for session issuance. Unverified users are
     * deliberately allowed through: they need a session to complete
     * verification, and `requireVerifiedProfile` blocks product capabilities
     * until they do.
     */
    beforeSessionCreation: async (ctx, { userId }) => {
      const typedCtx = ctx as unknown as GenericMutationCtx<DataModel>;
      const profile = await typedCtx.db
        .query("profiles")
        .withIndex("by_auth_user", (q) => q.eq("auth_user_id", userId))
        .unique();
      if (profile === null) return;
      if (profile.deleted_at !== undefined) throw new Error("Account is closed");
      if (profile.banned_at !== undefined) throw new Error("Account is banned");
      if (isSuspended(Date.now(), profile.suspended_at, profile.suspension_ends_at)) {
        throw new Error("Account is suspended");
      }
    },
  },
});
