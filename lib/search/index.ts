import { sanitizeSearchQuery } from "./sanitize";

export type SearchEntityKind = "place" | "mood" | "category" | "creator" | "post";

export type SearchIntent = {
  /** `keyword` is the MVP. `structured` is reserved for future NL parsing — no LLM. */
  mode: "keyword" | "structured";
  text: string;
};

/**
 * Current MVP: sanitize and search relationally (ilike).
 * Future queries such as "quán cà phê yên tĩnh quận 1 dưới 150k" can populate
 * structured filters here without changing callers of grouped search.
 */
export function parseSearchIntent(raw: string): SearchIntent {
  return { mode: "keyword", text: sanitizeSearchQuery(raw) };
}

export type SearchGroup<T> = {
  kind: SearchEntityKind;
  title: string;
  items: T[];
};
