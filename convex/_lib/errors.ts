import { ConvexError } from "convex/values";

export type DomainErrorCode =
  | "UNAUTHENTICATED" | "PROFILE_NOT_FOUND" | "ACCOUNT_INACTIVE"
  | "EMAIL_UNVERIFIED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT"
  | "VALIDATION_FAILED" | "CANDIDATE_LIMIT_EXCEEDED"
  | "PROFILE_NOT_PROVISIONED" | "USERNAME_TAKEN" | "INVALID_USERNAME"
  | "INVALID_DISPLAY_NAME" | "INVALID_BIO" | "INVALID_LOCALE"
  | "INVALID_TIMEZONE" | "INVALID_HOME_CITY" | "INVALID_MOOD"
  | "INVALID_STYLE" | "INVALID_BUDGET" | "INVALID_DURATION"
  | "INVALID_PASSWORD" | "INVALID_CREDENTIALS" | "RATE_LIMITED";

export function fail(code: DomainErrorCode, message: string): never {
  throw new ConvexError({ code, message });
}

export function invariant(
  condition: unknown,
  code: DomainErrorCode,
  message: string,
): asserts condition {
  if (!condition) fail(code, message);
}
