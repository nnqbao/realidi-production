import type { AnalyticsProvider } from "./types";

export const consoleAnalyticsProvider: AnalyticsProvider = {
  name: "console",
  async track(event, properties, userId) {
    if (process.env.NODE_ENV === "development") {
      console.info("[analytics]", event, { userId, ...properties });
    }
  },
};
