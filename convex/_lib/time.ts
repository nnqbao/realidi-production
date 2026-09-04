export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function nowMs(): number {
  return Date.now();
}

export function isActiveWindow(
  now: number,
  startsAt?: number,
  endsAt?: number,
): boolean {
  return (startsAt === undefined || startsAt <= now) &&
    (endsAt === undefined || now < endsAt);
}

export function isSuspended(
  now: number,
  suspendedAt?: number,
  suspensionEndsAt?: number,
): boolean {
  return suspendedAt !== undefined &&
    (suspensionEndsAt === undefined || suspensionEndsAt > now);
}

export function expiresAfter(now: number, ttlMs: number): number {
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
    throw new RangeError("now and ttlMs must be positive safe millisecond integers");
  }
  return now + ttlMs;
}
