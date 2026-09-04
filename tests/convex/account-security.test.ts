import { describe, expect, it } from "vitest";
import { api } from "@/convex/_generated/api";
import { GENERIC_AUTH_ERROR } from "@/convex/_providers/Password";
import {
  authHarness,
  authUserId,
  PASSWORD,
  signInWithPassword,
  signUp,
  verifiedUser,
} from "./auth-harness";

const NEW_PASSWORD = "brand-new-pass-2";

/** Domain failures arrive as `ConvexError` carrying a code; anything else is surfaced raw. */
async function failureCode(operation: Promise<unknown>): Promise<string> {
  try {
    await operation;
    return "<no error>";
  } catch (error) {
    const data = (error as { data?: { code?: string } }).data;
    return data?.code ?? (error as Error).message;
  }
}

describe("password change", () => {
  it("refuses a caller with no session", async () => {
    const t = authHarness();
    await verifiedUser(t, "porter@example.test");
    expect(await failureCode(t.action(api.account.changePassword, {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
      signOutOtherSessions: false,
    }))).toBe("UNAUTHENTICATED");
  });

  it("requires the current password to be re-proved", async () => {
    const t = authHarness();
    const user = await verifiedUser(t, "porter@example.test");
    expect(await failureCode(user.client.action(api.account.changePassword, {
      currentPassword: "not-my-password",
      newPassword: NEW_PASSWORD,
      signOutOtherSessions: false,
    }))).toBe("INVALID_CREDENTIALS");

    // The original credential still works, so nothing was changed.
    await expect(signInWithPassword(t, "porter@example.test")).resolves.toBeTruthy();
  });

  it("enforces the password policy on the replacement", async () => {
    const t = authHarness();
    const user = await verifiedUser(t, "porter@example.test");
    for (const candidate of ["tiny", "a".repeat(73)]) {
      expect(await failureCode(user.client.action(api.account.changePassword, {
        currentPassword: PASSWORD,
        newPassword: candidate,
        signOutOtherSessions: false,
      }))).toBe("INVALID_PASSWORD");
    }
    await expect(signInWithPassword(t, "porter@example.test")).resolves.toBeTruthy();
  });

  it("replaces the credential so only the new password works", async () => {
    const t = authHarness();
    const user = await verifiedUser(t, "porter@example.test");
    const result = await user.client.action(api.account.changePassword, {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
      signOutOtherSessions: false,
    });
    expect(result).toEqual({ ok: true, signedOutOtherSessions: false });

    expect(await failureCode(signInWithPassword(t, "porter@example.test", PASSWORD)))
      .toBe(GENERIC_AUTH_ERROR);
    await expect(signInWithPassword(t, "porter@example.test", NEW_PASSWORD))
      .resolves.toBeTruthy();
  });

  it("keeps the caller signed in while dropping other sessions on request", async () => {
    const t = authHarness();
    const user = await verifiedUser(t, "porter@example.test");
    await signInWithPassword(t, "porter@example.test");
    await signInWithPassword(t, "porter@example.test");
    const before = await t.run(async (ctx) =>
      (await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", user.authUserId))
        .collect()).length);
    expect(before).toBe(3);

    await user.client.action(api.account.changePassword, {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
      signOutOtherSessions: true,
    });

    const remaining = await t.run(async (ctx) =>
      await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", user.authUserId))
        .collect());
    expect(remaining.map((session) => session._id)).toEqual([user.sessionId]);
  });

  it("leaves other sessions alone when not asked to drop them", async () => {
    const t = authHarness();
    const user = await verifiedUser(t, "porter@example.test");
    await signInWithPassword(t, "porter@example.test");

    await user.client.action(api.account.changePassword, {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
      signOutOtherSessions: false,
    });

    const remaining = await t.run(async (ctx) =>
      (await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", user.authUserId))
        .collect()).length);
    expect(remaining).toBe(2);
  });

  it("refuses a banned or suspended account even with the right password", async () => {
    for (const state of ["banned_at", "deleted_at"] as const) {
      const t = authHarness();
      const user = await verifiedUser(t, "porter@example.test");
      await t.run(async (ctx) => {
        await ctx.db.patch(user.profileId, { [state]: Date.now() });
      });
      expect(await failureCode(user.client.action(api.account.changePassword, {
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
        signOutOtherSessions: false,
      }))).toBe("ACCOUNT_INACTIVE");
    }
  });

  it("records the change in the audit trail without the passwords", async () => {
    const t = authHarness();
    const user = await verifiedUser(t, "porter@example.test");
    await user.client.action(api.account.changePassword, {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
      signOutOtherSessions: true,
    });
    const entries = await t.run(async (ctx) =>
      (await ctx.db.query("audit_logs").collect())
        .filter((row) => row.action === "account.password_changed"));
    expect(entries).toHaveLength(1);
    expect(entries[0].actor_id).toBe(user.profileId);
    expect(JSON.stringify(entries)).not.toContain(PASSWORD);
    expect(JSON.stringify(entries)).not.toContain(NEW_PASSWORD);
  });
});

describe("session inventory", () => {
  it("lists only the caller's sessions and marks the current one", async () => {
    const t = authHarness();
    const user = await verifiedUser(t, "porter@example.test");
    await verifiedUser(t, "other@example.test");
    await signInWithPassword(t, "porter@example.test");

    const sessions = await user.client.query(api.sessions.list, {});
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((session) => session.isCurrent).map((s) => s.id))
      .toEqual([user.sessionId]);
    for (const session of sessions) {
      expect(session.expiresAt).toBeGreaterThan(session.createdAt);
    }
    // Newest first.
    expect(sessions[0].createdAt).toBeGreaterThanOrEqual(sessions[1].createdAt);
  });

  it("stays available to an unverified account", async () => {
    const t = authHarness();
    await signUp(t, "porter@example.test");
    const user = await authUserId(t, "porter@example.test");
    const client = t.withIdentity({ subject: `${user}|unused-session` });
    await expect(client.query(api.sessions.list, {})).resolves.toEqual([]);
  });

  it("refuses a guest", async () => {
    const t = authHarness();
    expect(await failureCode(t.query(api.sessions.list, {})))
      .toBe("UNAUTHENTICATED");
  });
});

describe("session revocation", () => {
  it("revokes every other session and keeps the caller's", async () => {
    const t = authHarness();
    const user = await verifiedUser(t, "porter@example.test");
    await signInWithPassword(t, "porter@example.test");
    await signInWithPassword(t, "porter@example.test");

    await user.client.action(api.sessions.revokeOthers, {});

    const sessions = await user.client.query(api.sessions.list, {});
    expect(sessions.map((session) => session.id)).toEqual([user.sessionId]);
  });

  it("revokes all sessions including the caller's", async () => {
    const t = authHarness();
    const user = await verifiedUser(t, "porter@example.test");
    await signInWithPassword(t, "porter@example.test");

    await user.client.action(api.sessions.revokeAll, {});

    expect(await user.client.query(api.sessions.list, {})).toEqual([]);
  });

  it("discards the refresh tokens along with the session", async () => {
    const t = authHarness();
    const user = await verifiedUser(t, "porter@example.test");
    expect(await t.run(async (ctx) =>
      (await ctx.db.query("authRefreshTokens").collect()).length))
      .toBeGreaterThan(0);

    await user.client.action(api.sessions.revokeAll, {});

    expect(await t.run(async (ctx) =>
      (await ctx.db.query("authRefreshTokens").collect()).length)).toBe(0);
  });

  it("revokes one named session and its refresh tokens", async () => {
    const t = authHarness();
    const user = await verifiedUser(t, "porter@example.test");
    await signInWithPassword(t, "porter@example.test");
    const sessions = await user.client.query(api.sessions.list, {});
    const other = sessions.find((session) => !session.isCurrent)!;

    await user.client.mutation(api.sessions.revoke, { sessionId: other.id });

    const remaining = await user.client.query(api.sessions.list, {});
    expect(remaining.map((session) => session.id)).toEqual([user.sessionId]);
    const orphaned = await t.run(async (ctx) =>
      (await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", other.id))
        .collect()).length);
    expect(orphaned).toBe(0);
  });

  it("reports another user's session as missing rather than forbidden", async () => {
    const t = authHarness();
    const porter = await verifiedUser(t, "porter@example.test");
    const other = await verifiedUser(t, "other@example.test");

    expect(await failureCode(porter.client.mutation(api.sessions.revoke, {
      sessionId: other.sessionId,
    }))).toBe("NOT_FOUND");

    // The target session survived the attempt.
    expect((await other.client.query(api.sessions.list, {})).map((s) => s.id))
      .toEqual([other.sessionId]);
  });
});
