/**
 * Future AI integration boundary.
 *
 * MVP ranking is deterministic and explainable — see lib/ranking.
 * Do not call a general-purpose LLM for place recommendation.
 *
 * When this module is implemented, models must be grounded in:
 * - Emotional Travel Graph (mood × place × context × time)
 * - Verified experience data
 * - Travel DNA (derived, not exposed yet)
 * - Crowd and real cost aggregates
 * - Internal trust signals
 *
 * AI must never become "Ask ChatGPT where to go."
 */

export type FutureAiContext = {
  moodId?: string;
  placeIds?: string[];
  userId?: string;
};

export async function recommendPlaces(context: FutureAiContext = {}): Promise<never> {
  void context;
  throw new Error("AI recommendations are not enabled in MVP. Use lib/ranking instead.");
}

export const AI_ENABLED = false;
