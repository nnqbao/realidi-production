import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";

export const FAILURE_LIMIT = 8;
export const LOCK_DURATION_MS = 15 * 60_000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function checkLockoutImpl(
  ctx: MutationCtx,
  email: string,
  now: number,
): Promise<{ locked: boolean; retryAt?: number }> {
  const email_normalized = normalizeEmail(email);
  const row = await ctx.db.query("auth_lockouts")
    .withIndex("by_email", (query) => query.eq("email_normalized", email_normalized))
    .unique();
  if (row === null || row.locked_until === undefined) return { locked: false };
  if (row.locked_until > now) return { locked: true, retryAt: row.locked_until };

  await ctx.db.patch(row._id, {
    failed_count: 0,
    locked_until: undefined,
    updated_at: now,
  });
  return { locked: false };
}

export async function recordFailureImpl(
  ctx: MutationCtx,
  email: string,
  now: number,
): Promise<{ locked: boolean; retryAt?: number }> {
  const email_normalized = normalizeEmail(email);
  const row = await ctx.db.query("auth_lockouts")
    .withIndex("by_email", (query) => query.eq("email_normalized", email_normalized))
    .unique();

  if (row?.locked_until !== undefined && row.locked_until > now) {
    return { locked: true, retryAt: row.locked_until };
  }

  const failed_count =
    row?.locked_until !== undefined && row.locked_until <= now
      ? 1
      : (row?.failed_count ?? 0) + 1;
  const locked_until =
    failed_count >= FAILURE_LIMIT ? now + LOCK_DURATION_MS : undefined;

  if (row === null) {
    await ctx.db.insert("auth_lockouts", {
      email_normalized,
      failed_count,
      ...(locked_until === undefined ? {} : { locked_until }),
      updated_at: now,
    });
  } else {
    await ctx.db.patch(row._id, { failed_count, locked_until, updated_at: now });
  }
  return locked_until === undefined
    ? { locked: false }
    : { locked: true, retryAt: locked_until };
}

export async function clearFailuresImpl(ctx: MutationCtx, email: string): Promise<void> {
  const row = await ctx.db.query("auth_lockouts")
    .withIndex("by_email", (query) =>
      query.eq("email_normalized", normalizeEmail(email)))
    .unique();
  if (row !== null) await ctx.db.delete(row._id);
}

export const CODE_REQUEST_LIMIT = 3;
export const CODE_REQUEST_WINDOW_MS = 15 * 60_000;

/**
 * Fixed-window throttle for outbound one-time codes, keyed by purpose plus
 * normalized email. Prevents using the reset/verify endpoints to flood a
 * third party's inbox. Callers must treat a denial as an ordinary success so
 * the throttle cannot be used to probe for registered addresses.
 */
export async function consumeCodeRequestImpl(
  ctx: MutationCtx,
  args: { key: string; limit?: number; windowMs?: number; now: number },
): Promise<{ allowed: boolean }> {
  const limit = args.limit ?? CODE_REQUEST_LIMIT;
  const windowMs = args.windowMs ?? CODE_REQUEST_WINDOW_MS;
  const row = await ctx.db.query("auth_code_requests")
    .withIndex("by_request_key", (query) => query.eq("request_key", args.key))
    .unique();

  if (row === null) {
    await ctx.db.insert("auth_code_requests", {
      request_key: args.key,
      window_started_at: args.now,
      count: 1,
    });
    return { allowed: true };
  }
  if (args.now - row.window_started_at >= windowMs) {
    await ctx.db.patch(row._id, { window_started_at: args.now, count: 1 });
    return { allowed: true };
  }
  if (row.count >= limit) return { allowed: false };
  await ctx.db.patch(row._id, { count: row.count + 1 });
  return { allowed: true };
}

export const consumeCodeRequest = internalMutation({
  args: {
    key: v.string(),
    limit: v.optional(v.number()),
    windowMs: v.optional(v.number()),
    now: v.number(),
  },
  handler: (ctx, args) => consumeCodeRequestImpl(ctx, args),
});

export const check = internalMutation({
  args: { email: v.string(), now: v.number() },
  handler: (ctx, args) => checkLockoutImpl(ctx, args.email, args.now),
});

export const recordFailure = internalMutation({
  args: { email: v.string(), now: v.number() },
  handler: (ctx, args) => recordFailureImpl(ctx, args.email, args.now),
});

export const clear = internalMutation({
  args: { email: v.string() },
  handler: (ctx, args) => clearFailuresImpl(ctx, args.email),
});
