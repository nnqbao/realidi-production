export const PRESENCE_IDLE_MS = 5 * 60_000;
export const PRESENCE_STALE_MS = 30 * 60_000;
export const PRESENCE_TRACK_THROTTLE_MS = 20_000;
export const LAST_ACTIVE_PING_MS = 90_000;

export type PresenceStatus = "online" | "idle" | "offline" | "unknown" | "hidden";

export type PresenceSnapshot = {
  status: PresenceStatus;
  lastActiveAt: string | null;
};

export const PRESENCE_DOT: Record<Exclude<PresenceStatus, "hidden">, string> = {
  online: "#22C55E",
  idle: "#22C55E",
  offline: "#EF4444",
  unknown: "#9CA3AF",
};
