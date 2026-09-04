import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GENERIC_AUTH_ERROR,
  PASSWORD_PROVIDER,
} from "@/convex/_providers/Password";
import { OTP_LENGTH, OTP_TTL_SECONDS } from "@/convex/_providers/EmailOtp";

const stock = (path: string) =>
  readFileSync(`node_modules/@convex-dev/auth/src/${path}`, "utf8");
const fork = (path: string) => readFileSync(`convex/${path}`, "utf8");

const FLOW_ORDER = [
  "signIn",
  "reset",
  "reset-verification",
  "email-verification",
] as const;

/** The body of one `flow` branch, anchored on the branch statement itself. */
function flowSection(source: string, flow: (typeof FLOW_ORDER)[number]): string {
  const branch = (name: string) => `} else if (flow === "${name}") {`;
  const start = source.indexOf(branch(flow));
  const next = FLOW_ORDER[FLOW_ORDER.indexOf(flow) + 1];
  const end = next === undefined
    ? source.indexOf("} else {", start)
    : source.indexOf(branch(next), start);
  if (start === -1 || end === -1) throw new Error(`No ${flow} branch found`);
  return source.slice(start, end);
}

describe("@convex-dev/auth self-hosted cutover compatibility", () => {
  it("records the exact tested package version", () => {
    const packageJson = JSON.parse(
      readFileSync("node_modules/@convex-dev/auth/package.json", "utf8"),
    ) as { version: string };
    expect(packageJson.version).toBe("0.0.95");
  });

  it("still lacks the failed-credential hook that forced the provider fork", () => {
    const password = stock("providers/Password.ts");
    expect(password).toContain(
      "const profile = config.profile?.(params, ctx) ?? defaultProfile(params);",
    );
    expect(password).not.toContain("await config.profile");
    expect(password).toContain('throw new Error("Invalid credentials")');
    expect(password).not.toMatch(/on(?:Failed|Invalid)Credentials|afterCredentialFailure/);
  });

  it("still exposes only a post-success session callback", () => {
    expect(stock("server/implementation/sessions.ts")).toContain(
      "await config.callbacks?.beforeSessionCreation?.(ctx, { userId });",
    );
  });

  it("keeps the adaptation notice next to the forked provider", () => {
    const notice = readFileSync("convex/_providers/NOTICE.md", "utf8");
    expect(notice).toContain("0.0.95");
    expect(notice).toMatch(/Apache-2\.0/);
  });
});

describe("forked provider closes the lockout gap", () => {
  const password = fork("_providers/Password.ts");

  it("checks the persistent lockout before verifying a credential", () => {
    const signInFlow = flowSection(password, "signIn");
    expect(signInFlow).toContain('"check"');
    expect(signInFlow).toContain("if (lockout.locked) throw new Error(GENERIC_AUTH_ERROR)");
    expect(signInFlow).toContain('runLockoutMutation(ctx, "clear"');
  });

  it("records a failure for unknown accounts and equalizes the hashing work", () => {
    expect(password).toContain('await runLockoutMutation(ctx, "recordFailure"');
    expect(password).toContain("InvalidAccountId");
    expect(password).toContain("dummyHash");
  });

  it("throttles outbound codes for both the reset and verification requests", () => {
    expect(password).toContain('mayRequestCode(ctx, "reset", email)');
    expect(password).toContain('mayRequestCode(ctx, "verify", email)');
  });
});

describe("forked provider closes the enumeration gap", () => {
  const password = fork("_providers/Password.ts");

  it("uses one indistinguishable credential error everywhere", () => {
    expect(GENERIC_AUTH_ERROR).toBe("Email or password is incorrect");
    expect(GENERIC_AUTH_ERROR).not.toMatch(/exist|unknown|found|registered|taken/i);
    // A duplicate registration must not surface the library's own message.
    expect(password).not.toContain("already exists");
  });

  it("answers a reset request the same way for unknown accounts", () => {
    const resetFlow = flowSection(password, "reset");
    expect(resetFlow).toContain("return null");
    expect(resetFlow).not.toContain("throw new Error(GENERIC_AUTH_ERROR)");
  });

  it("answers a verification resend the same way for unknown accounts", () => {
    const verifyFlow = flowSection(password, "email-verification");
    expect(verifyFlow).toContain("const isRedeeming = params.code !== undefined");
    expect(verifyFlow).toContain("if (isRedeeming) throw new Error(GENERIC_AUTH_ERROR)");
    expect(verifyFlow).toContain("return null");
  });

  it("makes the bridge's raw error forwarding harmless rather than relying on it", () => {
    // The stock Next.js bridge returns provider messages verbatim, so the
    // mitigation has to live in the messages themselves.
    const proxy = stock("nextjs/server/proxy.ts");
    expect(proxy).toContain(
      "const response = jsonResponse({ error: (error as Error).message }, 400);",
    );
    expect(proxy).toContain("// Send raw error message to client");
    expect(GENERIC_AUTH_ERROR).toBe("Email or password is incorrect");
  });
});

describe("one-time code providers", () => {
  it("separates the reset and verification purposes by provider id", () => {
    const providers = fork("_providers/EmailOtp.ts");
    expect(providers).toContain('otpProvider("verify-otp", "verify")');
    expect(providers).toContain('otpProvider("reset-otp", "reset")');
    expect(PASSWORD_PROVIDER).toBe("password");
  });

  it("expires codes and keeps them long enough to resist guessing", () => {
    expect(OTP_TTL_SECONDS).toBe(15 * 60);
    expect(OTP_LENGTH).toBeGreaterThanOrEqual(8);
  });

  it("relies on the library hashing codes at rest", () => {
    expect(stock("server/implementation/mutations/createVerificationCode.ts"))
      .toContain("code: await sha256(code)");
  });

  it("never returns a code to the caller and sends it out of band", () => {
    const providers = fork("_providers/EmailOtp.ts");
    expect(providers).toContain("internal.authEmails.sendCode");
    expect(fork("auth.ts")).not.toMatch(/return.*code/i);
  });
});
