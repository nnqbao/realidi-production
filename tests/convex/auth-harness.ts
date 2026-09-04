/**
 * Shared setup for tests that exercise the real Convex Auth functions rather
 * than calling helpers inline. Those functions need a signing key and the site
 * URLs, which a deployment normally supplies as environment variables.
 */
import { createPublicKey, generateKeyPairSync } from "node:crypto";
import { convexTest } from "convex-test";
import { api, internal } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import schema from "@/convex/schema";
import { OTP_TTL_SECONDS } from "@/convex/_providers/EmailOtp";

/** Keys are resolved relative to this file, which sits two levels below the repo root. */
const authTestModules = import.meta.glob("../../convex/**/*.ts");

function configureAuthEnv(): void {
  if (process.env.JWT_PRIVATE_KEY === undefined) {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    process.env.JWT_PRIVATE_KEY = privateKey;
    process.env.JWKS = JSON.stringify({
      keys: [
        {
          use: "sig",
          alg: "RS256",
          ...createPublicKey(publicKey).export({ format: "jwk" }),
        },
      ],
    });
  }
  process.env.SITE_URL ??= "http://127.0.0.1:3000";
  process.env.CONVEX_SITE_URL ??= "http://127.0.0.1:3223";
  process.env.SMTP_HOST ??= "127.0.0.1";
  process.env.SMTP_PORT ??= "1026";
  process.env.SMTP_FROM ??= "Realidi <no-reply@realidi.test>";
}

export function authHarness() {
  configureAuthEnv();
  return convexTest(schema, authTestModules);
}

export type Harness = ReturnType<typeof authHarness>;

export const PASSWORD = "correct-horse-1";

export async function signUp(
  t: Harness,
  email: string,
  password: string = PASSWORD,
  name = "Test Person",
): Promise<void> {
  await t.action(api.auth.signIn, {
    provider: "password",
    params: { flow: "signUp", email, password, name },
  });
}

export async function signInWithPassword(
  t: Harness,
  email: string,
  password: string = PASSWORD,
) {
  return await t.action(api.auth.signIn, {
    provider: "password",
    params: { flow: "signIn", email, password },
  });
}

export async function authUserId(t: Harness, email: string): Promise<Id<"users">> {
  const id = await t.run(async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    return user?._id ?? null;
  });
  if (id === null) throw new Error(`No auth user for ${email}`);
  return id;
}

export async function passwordAccountId(
  t: Harness,
  email: string,
): Promise<Id<"authAccounts">> {
  const id = await t.run(async (ctx) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email))
      .unique();
    return account?._id ?? null;
  });
  if (id === null) throw new Error(`No password account for ${email}`);
  return id;
}

/**
 * Plants a one-time code with a known plaintext through the same internal
 * mutation the email providers use. The stored code is hashed, so a test
 * cannot read back a generated one; issuing it here exercises the real
 * redemption path without needing to send or parse mail.
 */
export async function issueCode(
  t: Harness,
  args: {
    email: string;
    provider: "verify-otp" | "reset-otp";
    code: string;
    accountId?: Id<"authAccounts">;
    expirationTime?: number;
  },
): Promise<void> {
  const accountId = args.accountId ?? (await passwordAccountId(t, args.email));
  await t.mutation(internal.auth.store, {
    args: {
      type: "createVerificationCode",
      provider: args.provider,
      accountId,
      email: args.email,
      code: args.code,
      expirationTime: args.expirationTime ?? Date.now() + OTP_TTL_SECONDS * 1000,
      allowExtraProviders: true,
    },
  });
}

export async function latestSessionId(
  t: Harness,
  authUser: Id<"users">,
): Promise<Id<"authSessions">> {
  const id = await t.run(async (ctx) => {
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", authUser))
      .collect();
    const newest = sessions.sort((a, b) => b._creationTime - a._creationTime)[0];
    return newest?._id ?? null;
  });
  if (id === null) throw new Error("No session was created");
  return id;
}

/** Registers, verifies the address, then signs in and returns an authenticated client. */
export async function verifiedUser(
  t: Harness,
  email: string,
  password: string = PASSWORD,
): Promise<{
  authUserId: Id<"users">;
  profileId: Id<"profiles">;
  sessionId: Id<"authSessions">;
  client: ReturnType<Harness["withIdentity"]>;
}> {
  await signUp(t, email, password);
  await issueCode(t, { email, provider: "verify-otp", code: "13572468" });
  await t.action(api.auth.signIn, {
    provider: "password",
    params: { flow: "email-verification", email, code: "13572468" },
  });
  const user = await authUserId(t, email);
  const sessionId = await latestSessionId(t, user);
  const profileId = await t.run(async (ctx) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_auth_user", (q) => q.eq("auth_user_id", user))
      .unique();
    return profile!._id;
  });
  return {
    authUserId: user,
    profileId,
    sessionId,
    client: t.withIdentity({ subject: `${user}|${sessionId}` }),
  };
}

type ScheduledJob = { name: string; args: [{ email: string; purpose: string }] };

/**
 * The queued mail jobs, in scheduling order. Read instead of executed so the
 * suite never opens an SMTP connection, while still proving that a send was
 * wired up with the right address and purpose.
 */
export async function scheduledEmails(t: Harness): Promise<
  { email: string; purpose: string }[]
> {
  return await t.run(async (ctx) => {
    const system = ctx.db.system as unknown as {
      query: (table: string) => { collect: () => Promise<ScheduledJob[]> };
    };
    const jobs = await system.query("_scheduled_functions").collect();
    return jobs
      .filter((job) => job.name.includes("authEmails"))
      .map((job) => ({ email: job.args[0].email, purpose: job.args[0].purpose }));
  });
}
