/** Sanitize user search input for PostgREST ilike filters. */
export function sanitizeSearchQuery(raw: string, max = 80): string {
  return raw.replace(/[%_,()\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
