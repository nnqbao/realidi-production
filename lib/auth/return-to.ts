const INTERNAL_PREFIX = "/";
const BLOCKED = new Set(["//", "\\"]);

export function safeReturnPath(raw: unknown, fallback = "/home"): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (!value.startsWith(INTERNAL_PREFIX)) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("://")) return fallback;
  if (BLOCKED.has(value)) return fallback;
  if (value.length > 512) return fallback;
  try {
    const url = new URL(value, "https://realidi.local");
    if (url.origin !== "https://realidi.local") return fallback;
    return `${url.pathname}${url.search}${url.hash}` || fallback;
  } catch {
    return fallback;
  }
}
