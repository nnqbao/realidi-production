/**
 * Session inventory and revocation.
 *
 * Revoking the *current* session is `auth:signOut`. This module covers the
 * other two scopes plus single-session revocation. Session documents only
 * carry a creation time and an expiry, so no device or location detail is
 * reported here rather than inventing one.
 */
import { getAuthSessionId, invalidateSessions } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalQuery, mutation, query } from "./_generated/server";
import { requireIdentity } from "./_lib/authz";
import { invariant } from "./_lib/errors";

/**
 * Deliberately gated on identity alone, not on a verified or active profile:
 * seeing and cutting off sessions must keep working for exactly the accounts
 * that are in trouble.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const { authUserId } = await requireIdentity(ctx);
    const currentSessionId = await getAuthSessionId(ctx);
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", authUserId))
      .collect();
    return sessions
      .map((session) => ({
        id: session._id,
        createdAt: session._creationTime,
        expiresAt: session.expirationTime,
        isCurrent: session._id === currentSessionId,
      }))
      .sort((left, right) => right.createdAt - left.createdAt);
  },
});

export const currentUserId = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { authUserId } = await requireIdentity(ctx);
    return authUserId;
  },
});

/** Everything except the caller's own session. */
export const revokeOthers = action({
  args: {},
  handler: async (ctx) => {
    const authUserId = await ctx.runQuery(internal.sessions.currentUserId, {});
    const sessionId = await getAuthSessionId(ctx);
    await invalidateSessions(ctx, {
      userId: authUserId,
      except: sessionId === null ? [] : [sessionId],
    });
    return { ok: true as const };
  },
});

/**
 * Every session including the caller's. The client is signed out as a
 * consequence, so it should discard its tokens after this resolves.
 */
export const revokeAll = action({
  args: {},
  handler: async (ctx) => {
    const authUserId = await ctx.runQuery(internal.sessions.currentUserId, {});
    await invalidateSessions(ctx, { userId: authUserId });
    return { ok: true as const };
  },
});

/**
 * One specific session. Done transactionally instead of through
 * `invalidateSessions`, whose `except` list would have to be computed from a
 * separate read and would then delete any session created in between.
 */
export const revoke = mutation({
  args: { sessionId: v.id("authSessions") },
  handler: async (ctx, args) => {
    const { authUserId } = await requireIdentity(ctx);
    // Another user's session is reported as missing rather than forbidden, so
    // session IDs cannot be probed for existence.
    const session = await ctx.db.get(args.sessionId);
    invariant(
      session !== null && session.userId === authUserId,
      "NOT_FOUND",
      "Session not found",
    );

    const refreshTokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", args.sessionId as Id<"authSessions">))
      .collect();
    for (const token of refreshTokens) await ctx.db.delete(token._id);
    await ctx.db.delete(args.sessionId);
    return { ok: true as const };
  },
});
