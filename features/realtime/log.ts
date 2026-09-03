export type RealtimeStatus = "connecting" | "connected" | "reconnecting" | "disconnected" | "failed";

export function realtimeLog(event: string, extra?: Record<string, string | number | boolean | null>) {
  if (process.env.NODE_ENV === "production") return;
  if (extra) {
    console.info(`realtime: ${event}`, extra);
    return;
  }
  console.info(`realtime: ${event}`);
}
