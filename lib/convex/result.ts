import { ConvexError } from "convex/values";

export function convexErrorCode(error: unknown): string | undefined {
  if (error instanceof ConvexError) {
    const data = error.data as { code?: string } | string;
    if (typeof data === "object" && data !== null) return data.code;
  }
  const data = (error as { data?: { code?: string } }).data;
  return data?.code;
}

export function convexErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Request failed";
}

export function loginErrorCode(error: unknown): string {
  const message = convexErrorMessage(error);
  if (/banned/i.test(message)) return "banned";
  if (/closed/i.test(message)) return "deleted";
  if (/suspended/i.test(message)) return "suspended";
  return "INVALID_CREDENTIALS";
}
