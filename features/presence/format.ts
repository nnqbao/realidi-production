import { PRESENCE_IDLE_MS, PRESENCE_STALE_MS, type PresenceSnapshot, type PresenceStatus } from "./types";

export type TrackedPresence = { at: number; idle?: boolean; visible?: boolean };

export function presenceUserIdFromKey(key: string): string {
  const idx = key.indexOf("::");
  return idx === -1 ? key : key.slice(0, idx);
}

function rank(track: TrackedPresence): number {
  if (track.visible === false) return 0;
  if (track.idle) return 1;
  return 2;
}

export function mergePresenceTracks(
  state: Record<string, Array<TrackedPresence | undefined>>,
): Record<string, TrackedPresence> {
  const next: Record<string, TrackedPresence> = {};
  for (const [key, metas] of Object.entries(state)) {
    const userId = presenceUserIdFromKey(key);
    for (const meta of metas) {
      if (!meta) continue;
      const candidate: TrackedPresence = {
        at: Number(meta.at) || 0,
        idle: Boolean(meta.idle),
        visible: meta.visible !== false,
      };
      const existing = next[userId];
      if (!existing) {
        next[userId] = candidate;
        continue;
      }
      if (rank(candidate) > rank(existing) || (rank(candidate) === rank(existing) && candidate.at > existing.at)) {
        next[userId] = candidate;
      }
    }
  }
  return next;
}

export function resolvePresence(input: {
  connected?: boolean;
  lastTrackAt?: number | null;
  idle?: boolean;
  lastActiveAt?: string | null;
  showActivity?: boolean | null;
  now?: Date;
}): PresenceSnapshot {
  const now = input.now ?? new Date();
  if (input.showActivity === false) {
    return { status: "hidden", lastActiveAt: null };
  }

  const lastActiveAt = input.lastActiveAt ?? (input.lastTrackAt ? new Date(input.lastTrackAt).toISOString() : null);
  const trackAge = input.lastTrackAt != null ? now.getTime() - input.lastTrackAt : null;

  if (input.connected && trackAge != null && trackAge < PRESENCE_STALE_MS) {
    if (input.idle || trackAge >= PRESENCE_IDLE_MS) {
      return { status: "idle", lastActiveAt };
    }
    return { status: "online", lastActiveAt };
  }

  if (!lastActiveAt) {
    return { status: "unknown", lastActiveAt: null };
  }

  return { status: "offline", lastActiveAt };
}

export function presenceCopy(status: PresenceStatus, lastActiveAt?: string | null, now = new Date()): string | null {
  if (status === "hidden") return null;
  if (status === "online") return "Đang hoạt động";
  if (status === "idle") return "Vừa hoạt động";
  if (status === "unknown") return "Không rõ trạng thái";
  if (!lastActiveAt) return "Ngoại tuyến";
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(lastActiveAt).getTime()) / 60_000));
  if (minutes < 8) return "Hoạt động gần đây";
  if (minutes < 60) return `Hoạt động ${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hoạt động ${hours} giờ trước`;
  if (hours < 48) return "Hoạt động hôm qua";
  return "Ngoại tuyến";
}

export function presenceAriaLabel(status: PresenceStatus, lastActiveAt?: string | null): string {
  return presenceCopy(status, lastActiveAt) ?? "Trạng thái hoạt động";
}
