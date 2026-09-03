import type {
  AnalyticsProperties,
  AnalyticsProvider,
  ProductEventName,
  TrackContext,
} from "./types";
import { consoleAnalyticsProvider } from "./console-provider";
import { posthogAnalyticsProvider } from "./posthog-provider";

function vendorProvider(): AnalyticsProvider {
  const name = process.env.ANALYTICS_PROVIDER ?? "console";
  if (name === "posthog") return posthogAnalyticsProvider;
  if (name === "none") {
    return { name: "none", async track() {} };
  }
  return consoleAnalyticsProvider;
}

export function getAnalyticsProvider(): AnalyticsProvider {
  return vendorProvider();
}

/**
 * Client/server-safe track helper. Persistence to product_events happens in
 * the server action `recordProductEvent` so RLS and user_id stay consistent.
 */
export async function trackEvent(
  event: ProductEventName,
  properties: AnalyticsProperties = {},
  context: TrackContext = {},
): Promise<void> {
  await getAnalyticsProvider().track(event, { ...properties, session_id: context.sessionId }, context.userId);
}

export type { ProductEventName, AnalyticsProperties, AnalyticsProvider };
export { PRODUCT_EVENTS } from "./types";
