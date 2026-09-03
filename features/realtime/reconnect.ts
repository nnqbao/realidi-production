export const RECONNECT_BANNER_MS = 1800;
export const RECONNECT_MAX_DELAY_MS = 30_000;

export function shouldShowReconnect(disconnectedSince: number | null, now = Date.now()): boolean {
  if (disconnectedSince == null) return false;
  return now - disconnectedSince >= RECONNECT_BANNER_MS;
}

export function nextReconnectDelay(attempt: number, random = Math.random()): number {
  const exp = Math.min(30_000, 800 * 2 ** Math.min(Math.max(attempt, 0), 6));
  const jittered = exp * (0.7 + random * 0.6);
  return Math.round(Math.min(RECONNECT_MAX_DELAY_MS, jittered));
}

export function conversationChannelName(conversationId: string): string {
  return `chat:${conversationId}`;
}

export const PRESENCE_CHANNEL = "realidi-presence";

export function presenceTrackKey(userId: string, tabId: string): string {
  return `${userId}::${tabId}`;
}

export function presenceUserIdFromKey(key: string): string {
  const idx = key.indexOf("::");
  return idx === -1 ? key : key.slice(0, idx);
}
