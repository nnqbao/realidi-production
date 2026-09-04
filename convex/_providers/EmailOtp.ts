/**
 * One-time email codes for address verification and password reset.
 *
 * Two separate provider IDs keep the two purposes from being interchangeable:
 * a code issued for a reset cannot be redeemed to verify an address, because
 * `verifyCodeAndSignIn` rejects a code whose stored provider does not match the
 * provider it is redeemed against.
 */
import { Email } from "@convex-dev/auth/providers/Email";
import type { EmailConfig } from "@convex-dev/auth/server";
import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";
import { internal } from "../_generated/api";

export const OTP_LENGTH = 8;
export const OTP_TTL_SECONDS = 15 * 60;

const DIGITS = "0123456789";

/**
 * Uniform 8-digit code. Values at or above `LIMIT` are discarded so that
 * `byte % 10` cannot bias the low digits, which plain modulo would.
 */
export function generateOtp(length: number = OTP_LENGTH): string {
  const LIMIT = 256 - (256 % DIGITS.length);
  const buffer = new Uint8Array(length * 2);
  let code = "";
  while (code.length < length) {
    crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (byte < LIMIT && code.length < length) {
        code += DIGITS[byte % DIGITS.length];
      }
    }
  }
  return code;
}

type SendVerificationRequest = (
  params: { identifier: string; token: string; expires: Date },
  ctx: GenericActionCtx<DataModel>,
) => Promise<void>;

function otpProvider(id: string, purpose: "verify" | "reset"): EmailConfig {
  const send: SendVerificationRequest = async ({ identifier, token, expires }, ctx) => {
    // Scheduled rather than awaited so that the caller's response time does not
    // reveal whether an address was actually mailed.
    await ctx.scheduler.runAfter(0, internal.authEmails.sendCode, {
      email: identifier,
      code: token,
      purpose,
      expiresAt: expires.getTime(),
    });
  };

  return Email({
    id,
    maxAge: OTP_TTL_SECONDS,
    generateVerificationToken: async () => generateOtp(),
    // The library invokes this with the action ctx as a second argument, which
    // the upstream Auth.js type does not describe.
    sendVerificationRequest: send as unknown as EmailConfig["sendVerificationRequest"],
  });
}

/** Confirms a newly registered address, or re-confirms on request. */
export const VerifyEmailOtp = otpProvider("verify-otp", "verify");

/** Authorizes setting a new password without the current one. */
export const ResetPasswordOtp = otpProvider("reset-otp", "reset");
