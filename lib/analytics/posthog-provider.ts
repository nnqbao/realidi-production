import type { AnalyticsProvider } from "./types";

/**
 * PostHog adapter. Only used when ANALYTICS_PROVIDER=posthog and ANALYTICS_KEY is set.
 * Does not throw if the vendor is unreachable — events still persist first-party.
 */
export const posthogAnalyticsProvider: AnalyticsProvider = {
  name: "posthog",
  async track(event, properties, userId) {
    const key = process.env.ANALYTICS_KEY;
    if (!key) return;
    try {
      await fetch("https://us.i.posthog.com/capture/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          event,
          distinct_id: userId ?? "anonymous",
          properties: properties ?? {},
        }),
      });
    } catch {
      // First-party table is the source of truth for MVP metrics.
    }
  },
};
