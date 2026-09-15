"use node";

import { v } from "convex/values";
import { Scrypt } from "lucia";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { fail } from "./_lib/errors";
import {
  PASSWORD_POLICY_ERROR,
  validatePasswordRequirements,
} from "./_providers/Password";

type BootstrapOwnerResult = {
  profileId: Id<"profiles">;
  created: boolean;
  role: "owner" | "admin";
  mustChangePassword: boolean;
};

/**
 * CLI-only owner/admin bootstrap. Hashing runs in Node because Lucia's Scrypt
 * exceeds the Convex isolate memory limit.
 */
export const provisionBootstrapOwner = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
    displayName: v.optional(v.string()),
    role: v.optional(v.union(v.literal("owner"), v.literal("admin"))),
  },
  handler: async (ctx, args): Promise<BootstrapOwnerResult> => {
    try {
      validatePasswordRequirements(args.password);
    } catch {
      fail("INVALID_PASSWORD", PASSWORD_POLICY_ERROR);
    }
    const secret = await new Scrypt().hash(args.password);
    return await ctx.runMutation(internal.account.applyBootstrapOwner, {
      email: args.email,
      secret,
      displayName: args.displayName,
      role: args.role,
    });
  },
});
