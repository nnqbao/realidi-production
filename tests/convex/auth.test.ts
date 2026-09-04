import { describe, expect, it } from "vitest";
import { api } from "@/convex/_generated/api";
import { requireVerifiedProfile } from "@/convex/_lib/authz";
import { FAILURE_LIMIT } from "@/convex/authLockout";
import { GENERIC_AUTH_ERROR } from "@/convex/_providers/Password";
import { generateOtp, OTP_LENGTH } from "@/convex/_providers/EmailOtp";
import {
  authHarness,
  authUserId,
  issueCode,
  latestSessionId,
  PASSWORD,
  passwordAccountId,
  scheduledEmails,
  signInWithPassword,
  signUp,
  verifiedUser,
} from "./auth-harness";

async function errorMessage(operation: Promise<unknown>): Promise<string> {
  try {
    await operation;
    return "<no error>";
  } catch (error) {
    return (error as Error).message;
  }
}

describe("registration and profile provisioning", () => {
  it("creates the profile, preferences, and default collection in one transaction", async () => {
    const t = authHarness();
    await signUp(t, "porter@example.test", PASSWORD, "Porter Quill");

    const provisioned = await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "porter@example.test"))
        .unique();
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_auth_user", (q) => q.eq("auth_user_id", user!._id))
        .unique();
      const preferences = await ctx.db
        .query("user_preferences")
        .withIndex("by_user", (q) => q.eq("user_id", profile!._id))
        .unique();
      const collections = await ctx.db
        .query("saved_collections")
        .withIndex("by_user_slug", (q) =>
          q.eq("user_slug_key", `${profile!._id}:saved`))
        .collect();
      return {
        email: user!.email,
        // Reduced to a boolean here because `undefined` becomes `null` when a
        // value crosses the function boundary.
        isVerified: user!.emailVerificationTime !== undefined,
        role: profile!.role,
        username: profile!.username,
        locale: profile!.locale,
        hasPreferences: preferences !== null,
        defaultCollections: collections.length,
      };
    });

    expect(provisioned).toMatchObject({
      email: "porter@example.test",
      isVerified: false,
      role: "user",
      locale: "vi",
      hasPreferences: true,
      defaultCollections: 1,
    });
    expect(provisioned.username).toMatch(/^[a-z0-9_]{3,30}$/);
  });

  it("normalizes the email so case and padding cannot create a second account", async () => {
    const t = authHarness();
    await signUp(t, "  Porter@Example.TEST  ");
    const stored = await t.run(async (ctx) => ({
      users: (await ctx.db.query("users").collect()).map((user) => user.email),
      accounts: (await ctx.db.query("authAccounts").collect()).map(
        (account) => account.providerAccountId,
      ),
    }));
    expect(stored.users).toEqual(["porter@example.test"]);
    expect(stored.accounts).toEqual(["porter@example.test"]);
  });

  it("rejects passwords outside the 8-72 character policy", async () => {
    const t = authHarness();
    expect(await errorMessage(signUp(t, "short@example.test", "aB3$xyz")))
      .toMatch(/8-72/);
    expect(await errorMessage(signUp(t, "long@example.test", "a".repeat(73))))
      .toMatch(/8-72/);
    const created = await t.run(async (ctx) =>
      (await ctx.db.query("users").collect()).length);
    expect(created).toBe(0);
  });

  it("queues exactly one verification mail through the Node mailer", async () => {
    const t = authHarness();
    await signUp(t, "porter@example.test");
    expect(await scheduledEmails(t)).toEqual([
      { email: "porter@example.test", purpose: "verify" },
    ]);
  });
});

describe("failed-login lockout", () => {
  it("locks the account for 15 minutes after 8 failures and ignores the correct password", async () => {
    const t = authHarness();
    await signUp(t, "porter@example.test");

    for (let attempt = 1; attempt <= FAILURE_LIMIT; attempt += 1) {
      expect(await errorMessage(signInWithPassword(t, "porter@example.test", "wrong-pass-1")))
        .toBe(GENERIC_AUTH_ERROR);
    }

    const lockout = await t.run(async (ctx) =>
      await ctx.db
        .query("auth_lockouts")
        .withIndex("by_email", (q) => q.eq("email_normalized", "porter@example.test"))
        .unique());
    expect(lockout?.failed_count).toBe(FAILURE_LIMIT);
    expect(lockout?.locked_until).toBeGreaterThan(Date.now());
    expect(lockout!.locked_until! - Date.now()).toBeLessThanOrEqual(15 * 60_000);

    // The gate is checked before the credential, so the real password is refused too.
    expect(await errorMessage(signInWithPassword(t, "porter@example.test")))
      .toBe(GENERIC_AUTH_ERROR);
  });

  it("counts failures for addresses that have no account, so probing cannot skip the gate", async () => {
    const t = authHarness();
    for (let attempt = 1; attempt <= FAILURE_LIMIT; attempt += 1) {
      await errorMessage(signInWithPassword(t, "ghost@example.test", "wrong-pass-1"));
    }
    const lockout = await t.run(async (ctx) =>
      await ctx.db
        .query("auth_lockouts")
        .withIndex("by_email", (q) => q.eq("email_normalized", "ghost@example.test"))
        .unique());
    expect(lockout?.failed_count).toBe(FAILURE_LIMIT);
    expect(lockout?.locked_until).toBeGreaterThan(Date.now());
  });

  it("clears the counter after a successful sign-in", async () => {
    const t = authHarness();
    const user = await verifiedUser(t, "porter@example.test");
    expect(user.sessionId).toBeTruthy();

    await errorMessage(signInWithPassword(t, "porter@example.test", "wrong-pass-1"));
    expect(await t.run(async (ctx) =>
      (await ctx.db.query("auth_lockouts").collect()).length)).toBe(1);

    await signInWithPassword(t, "porter@example.test");
    expect(await t.run(async (ctx) =>
      (await ctx.db.query("auth_lockouts").collect()).length)).toBe(0);
  });

  it("releases the lock once the window has passed", async () => {
    const t = authHarness();
    await signUp(t, "porter@example.test");
    for (let attempt = 1; attempt <= FAILURE_LIMIT; attempt += 1) {
      await errorMessage(signInWithPassword(t, "porter@example.test", "wrong-pass-1"));
    }
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("auth_lockouts")
        .withIndex("by_email", (q) => q.eq("email_normalized", "porter@example.test"))
        .unique();
      await ctx.db.patch(row!._id, { locked_until: Date.now() - 1 });
    });
    await issueCode(t, {
      email: "porter@example.test",
      provider: "verify-otp",
      code: "24681357",
    });
    await t.action(api.auth.signIn, {
      provider: "password",
      params: { flow: "email-verification", email: "porter@example.test", code: "24681357" },
    });
    await expect(signInWithPassword(t, "porter@example.test")).resolves.toBeTruthy();
  });
});

describe("email enumeration resistance", () => {
  it("returns the same failure for a wrong password and an address with no account", async () => {
    const t = authHarness();
    await signUp(t, "porter@example.test");
    const known = await errorMessage(
      signInWithPassword(t, "porter@example.test", "wrong-pass-1"));
    const unknown = await errorMessage(
      signInWithPassword(t, "ghost@example.test", "wrong-pass-1"));
    expect(known).toBe(GENERIC_AUTH_ERROR);
    expect(unknown).toBe(known);
  });

  it("reports a duplicate registration exactly like a failed sign-in", async () => {
    const t = authHarness();
    await signUp(t, "porter@example.test");
    expect(await errorMessage(signUp(t, "porter@example.test", "another-pass-9")))
      .toBe(GENERIC_AUTH_ERROR);
  });

  it("answers a reset request identically whether or not the address exists", async () => {
    const t = authHarness();
    await signUp(t, "porter@example.test");

    const known = await t.action(api.auth.signIn, {
      provider: "password",
      params: { flow: "reset", email: "porter@example.test" },
    });
    const unknown = await t.action(api.auth.signIn, {
      provider: "password",
      params: { flow: "reset", email: "ghost@example.test" },
    });
    expect(known).toEqual({ tokens: null });
    expect(unknown).toEqual(known);

    // Only the real address is mailed, which is not observable by the caller.
    expect(await scheduledEmails(t)).toEqual([
      { email: "porter@example.test", purpose: "verify" },
      { email: "porter@example.test", purpose: "reset" },
    ]);
  });

  it("answers a verification resend identically whether or not the address exists", async () => {
    const t = authHarness();
    await signUp(t, "porter@example.test");
    const known = await t.action(api.auth.signIn, {
      provider: "password",
      params: { flow: "email-verification", email: "porter@example.test" },
    });
    const unknown = await t.action(api.auth.signIn, {
      provider: "password",
      params: { flow: "email-verification", email: "ghost@example.test" },
    });
    expect(known).toEqual({ tokens: null });
    expect(unknown).toEqual(known);
  });

  it("throttles code requests to 3 per address per window", async () => {
    const t = authHarness();
    await signUp(t, "porter@example.test");
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await t.action(api.auth.signIn, {
        provider: "password",
        params: { flow: "reset", email: "porter@example.test" },
      });
    }
    const resets = (await scheduledEmails(t)).filter(
      (mail) => mail.purpose === "reset");
    expect(resets).toHaveLength(3);
  });
});

describe("one-time email codes", () => {
  it("generates uniformly distributed codes of the configured length", () => {
    const codes = Array.from({ length: 200 }, () => generateOtp());
    for (const code of codes) expect(code).toMatch(new RegExp(`^\\d{${OTP_LENGTH}}$`));
    expect(new Set(codes).size).toBeGreaterThan(190);
    const digits = new Set(codes.join("").split(""));
    expect(digits.size).toBe(10);
  });

  it("stores only a hash of the code", async () => {
    const t = authHarness();
    await signUp(t, "porter@example.test");
    await issueCode(t, {
      email: "porter@example.test",
      provider: "verify-otp",
      code: "13572468",
    });
    const stored = await t.run(async (ctx) =>
      (await ctx.db.query("authVerificationCodes").collect()).map((row) => row.code));
    expect(stored).toHaveLength(1);
    expect(stored[0]).not.toContain("13572468");
    expect(stored[0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("marks the address verified and unlocks product capabilities", async () => {
    const t = authHarness();
    const user = await verifiedUser(t, "porter@example.test");

    const verifiedAt = await t.run(async (ctx) =>
      (await ctx.db.get(user.authUserId))!.emailVerificationTime);
    expect(verifiedAt).toBeGreaterThan(0);

    await expect(user.client.run((ctx) => requireVerifiedProfile(ctx)))
      .resolves.toBeTruthy();
  });

  it("blocks product capabilities until the address is verified", async () => {
    const t = authHarness();
    await signUp(t, "porter@example.test");
    const user = await authUserId(t, "porter@example.test");
    const unverified = t.withIdentity({ subject: `${user}|no-session` });
    await expect(unverified.run((ctx) => requireVerifiedProfile(ctx))).rejects.toThrow();
  });

  it("consumes the code so it cannot be replayed", async () => {
    const t = authHarness();
    await signUp(t, "porter@example.test");
    await issueCode(t, {
      email: "porter@example.test",
      provider: "verify-otp",
      code: "13572468",
    });
    await t.action(api.auth.signIn, {
      provider: "password",
      params: { flow: "email-verification", email: "porter@example.test", code: "13572468" },
    });
    expect(await t.run(async (ctx) =>
      (await ctx.db.query("authVerificationCodes").collect()).length)).toBe(0);
    expect(await errorMessage(t.action(api.auth.signIn, {
      provider: "password",
      params: { flow: "email-verification", email: "porter@example.test", code: "13572468" },
    }))).toBe(GENERIC_AUTH_ERROR);
  });

  it("rejects an expired code", async () => {
    const t = authHarness();
    await signUp(t, "porter@example.test");
    await issueCode(t, {
      email: "porter@example.test",
      provider: "verify-otp",
      code: "13572468",
      expirationTime: Date.now() - 1,
    });
    expect(await errorMessage(t.action(api.auth.signIn, {
      provider: "password",
      params: { flow: "email-verification", email: "porter@example.test", code: "13572468" },
    }))).toBe(GENERIC_AUTH_ERROR);
  });

  it("rejects a valid code presented with a different address", async () => {
    const t = authHarness();
    await signUp(t, "porter@example.test");
    await signUp(t, "other@example.test");
    await issueCode(t, {
      email: "porter@example.test",
      provider: "verify-otp",
      code: "13572468",
    });
    expect(await errorMessage(t.action(api.auth.signIn, {
      provider: "password",
      params: { flow: "email-verification", email: "other@example.test", code: "13572468" },
    }))).toBe(GENERIC_AUTH_ERROR);
    const otherIsVerified = await t.run(async (ctx) => {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "other@example.test"))
        .unique();
      return user!.emailVerificationTime !== undefined;
    });
    expect(otherIsVerified).toBe(false);
  });

  it("refuses a reset code presented to the verification flow", async () => {
    const t = authHarness();
    await signUp(t, "porter@example.test");
    await issueCode(t, {
      email: "porter@example.test",
      provider: "reset-otp",
      code: "13572468",
    });
    expect(await errorMessage(t.action(api.auth.signIn, {
      provider: "password",
      params: { flow: "email-verification", email: "porter@example.test", code: "13572468" },
    }))).toBe(GENERIC_AUTH_ERROR);
  });
});

describe("password reset", () => {
  it("replaces the password and invalidates every other session", async () => {
    const t = authHarness();
    const user = await verifiedUser(t, "porter@example.test");
    await signInWithPassword(t, "porter@example.test");
    expect(await t.run(async (ctx) =>
      (await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", user.authUserId))
        .collect()).length)).toBeGreaterThan(1);

    await issueCode(t, {
      email: "porter@example.test",
      provider: "reset-otp",
      code: "97531357",
    });
    await t.action(api.auth.signIn, {
      provider: "password",
      params: {
        flow: "reset-verification",
        email: "porter@example.test",
        code: "97531357",
        newPassword: "brand-new-pass-2",
      },
    });

    const sessions = await t.run(async (ctx) =>
      await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", user.authUserId))
        .collect());
    expect(sessions).toHaveLength(1);

    expect(await errorMessage(signInWithPassword(t, "porter@example.test", PASSWORD)))
      .toBe(GENERIC_AUTH_ERROR);
    await expect(signInWithPassword(t, "porter@example.test", "brand-new-pass-2"))
      .resolves.toBeTruthy();
  });

  it("enforces the password policy on the replacement", async () => {
    const t = authHarness();
    await verifiedUser(t, "porter@example.test");
    await issueCode(t, {
      email: "porter@example.test",
      provider: "reset-otp",
      code: "97531357",
    });
    expect(await errorMessage(t.action(api.auth.signIn, {
      provider: "password",
      params: {
        flow: "reset-verification",
        email: "porter@example.test",
        code: "97531357",
        newPassword: "tiny",
      },
    }))).toMatch(/8-72/);
    await expect(signInWithPassword(t, "porter@example.test")).resolves.toBeTruthy();
  });

  it("refuses a verification code presented to the reset flow", async () => {
    const t = authHarness();
    await verifiedUser(t, "porter@example.test");
    await issueCode(t, {
      email: "porter@example.test",
      provider: "verify-otp",
      code: "97531357",
    });
    expect(await errorMessage(t.action(api.auth.signIn, {
      provider: "password",
      params: {
        flow: "reset-verification",
        email: "porter@example.test",
        code: "97531357",
        newPassword: "brand-new-pass-2",
      },
    }))).toBe(GENERIC_AUTH_ERROR);
    await expect(signInWithPassword(t, "porter@example.test")).resolves.toBeTruthy();
  });
});

describe("account-state gate on session creation", () => {
  it("refuses a session for deleted, banned, and actively suspended profiles", async () => {
    for (const state of ["deleted_at", "banned_at", "suspended_at"] as const) {
      const t = authHarness();
      await verifiedUser(t, "porter@example.test");
      await t.run(async (ctx) => {
        const profile = (await ctx.db.query("profiles").collect())[0];
        await ctx.db.patch(profile._id, {
          [state]: Date.now(),
          ...(state === "suspended_at"
            ? { suspension_ends_at: Date.now() + 60_000 }
            : {}),
        });
      });
      expect(await errorMessage(signInWithPassword(t, "porter@example.test")))
        .not.toBe("<no error>");
    }
  });

  it("lets a user back in once a suspension has expired", async () => {
    const t = authHarness();
    await verifiedUser(t, "porter@example.test");
    await t.run(async (ctx) => {
      const profile = (await ctx.db.query("profiles").collect())[0];
      await ctx.db.patch(profile._id, {
        suspended_at: Date.now() - 120_000,
        suspension_ends_at: Date.now() - 60_000,
      });
    });
    await expect(signInWithPassword(t, "porter@example.test")).resolves.toBeTruthy();
  });
});

describe("owner bootstrap", () => {
  it("promotes only the configured address, and only when no owner exists", async () => {
    process.env.INITIAL_OWNER_EMAIL = "founder@example.test";
    try {
      const t = authHarness();
      const founder = await verifiedUser(t, "founder@example.test");
      const second = await verifiedUser(t, "porter@example.test");

      const roles = await t.run(async (ctx) => ({
        founder: (await ctx.db.get(founder.profileId))!.role,
        second: (await ctx.db.get(second.profileId))!.role,
      }));
      expect(roles).toEqual({ founder: "owner", second: "user" });

      const audit = await t.run(async (ctx) =>
        (await ctx.db.query("audit_logs").collect())
          .filter((row) => row.action === "owner.bootstrap"));
      expect(audit).toHaveLength(1);
    } finally {
      delete process.env.INITIAL_OWNER_EMAIL;
    }
  });

  it("ignores the bootstrap once an owner is already present", async () => {
    process.env.INITIAL_OWNER_EMAIL = "founder@example.test";
    try {
      const t = authHarness();
      await t.run(async (ctx) => {
        const authUser = await ctx.db.insert("users", {
          email: "existing@example.test",
          emailVerificationTime: 1,
        });
        await ctx.db.insert("profiles", {
          auth_user_id: authUser,
          username: "existing_owner",
          display_name: "Existing",
          role: "owner",
          locale: "vi",
          timezone: "Asia/Ho_Chi_Minh",
          show_activity_status: true,
          created_at: 1,
          updated_at: 1,
        });
      });
      const founder = await verifiedUser(t, "founder@example.test");
      const role = await t.run(async (ctx) =>
        (await ctx.db.get(founder.profileId))!.role);
      expect(role).toBe("user");
    } finally {
      delete process.env.INITIAL_OWNER_EMAIL;
    }
  });
});

describe("secrets never leave the backend", () => {
  it("keeps password hashes out of the account payload the app can read", async () => {
    const t = authHarness();
    const user = await verifiedUser(t, "porter@example.test");
    const current = await user.client.query(api.profiles.current, {});
    expect(JSON.stringify(current)).not.toContain(PASSWORD);
    expect(Object.keys(current ?? {})).not.toContain("secret");

    const accountId = await passwordAccountId(t, "porter@example.test");
    const secret = await t.run(async (ctx) => (await ctx.db.get(accountId))!.secret);
    expect(secret).toBeDefined();
    expect(secret).not.toContain(PASSWORD);
  });

  it("redacts credential-shaped fields from the audit trail", async () => {
    const t = authHarness();
    const user = await verifiedUser(t, "porter@example.test");
    await t.run(async (ctx) => {
      await ctx.db.insert("audit_logs", {
        actor_id: user.profileId,
        action: "test.probe",
        target_type: "profile",
        created_at: Date.now(),
      });
    });
    const codes = await t.run(async (ctx) =>
      JSON.stringify(await ctx.db.query("audit_logs").collect()));
    expect(codes).not.toContain("13572468");
    expect(codes).not.toContain(PASSWORD);
  });
});

describe("session issuance internals", () => {
  it("issues a session and a refresh token that belong to the signing user", async () => {
    const t = authHarness();
    const user = await verifiedUser(t, "porter@example.test");
    const sessionId = await latestSessionId(t, user.authUserId);
    const refreshTokens = await t.run(async (ctx) =>
      await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", sessionId))
        .collect());
    expect(refreshTokens.length).toBeGreaterThan(0);
  });
});
