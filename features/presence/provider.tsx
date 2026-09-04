"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { pingLastActive } from "./actions";
import { LAST_ACTIVE_PING_MS, PRESENCE_IDLE_MS, type PresenceSnapshot } from "./types";

type PresenceValue = {
  getUserPresence: (userId: string, lastActiveAt?: string | null, showActivity?: boolean | null) => PresenceSnapshot;
  online: Set<string>;
};

const PresenceContext = createContext<PresenceValue>({
  getUserPresence: (_id, lastActiveAt, showActivity) => {
    if (showActivity === false) return { status: "hidden", lastActiveAt: null };
    if (!lastActiveAt) return { status: "unknown", lastActiveAt: null };
    return { status: "offline", lastActiveAt };
  },
  online: new Set(),
});

export function usePresence() {
  return useContext(PresenceContext);
}

function statusFromLastActive(
  lastActiveAt?: string | null,
  showActivity?: boolean | null,
  now = Date.now(),
): PresenceSnapshot {
  if (showActivity === false) return { status: "hidden", lastActiveAt: null };
  if (!lastActiveAt) return { status: "unknown", lastActiveAt: null };
  const age = now - new Date(lastActiveAt).getTime();
  if (age <= LAST_ACTIVE_PING_MS) return { status: "online", lastActiveAt };
  if (age <= PRESENCE_IDLE_MS) return { status: "idle", lastActiveAt };
  return { status: "offline", lastActiveAt };
}

export function PresenceProvider({
  userId,
  showActivity = true,
  children,
}: {
  userId?: string | null;
  showActivity?: boolean;
  children: ReactNode;
}) {
  const lastPing = useRef(0);
  const lastActivity = useRef(0);
  const userIdRef = useRef(userId);

  const ping = useCallback((idle = false) => {
    if (!userIdRef.current) return;
    const now = Date.now();
    if (!idle && now - lastPing.current < LAST_ACTIVE_PING_MS) return;
    lastPing.current = now;
    void pingLastActive(idle);
  }, []);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    lastActivity.current = Date.now();
    ping(false);

    const onActivity = () => {
      lastActivity.current = Date.now();
      ping(false);
    };
    window.addEventListener("click", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("pointerdown", onActivity, { passive: true });

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        lastActivity.current = Date.now();
        ping(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onPageHide = () => {
      void pingLastActive(true);
    };
    window.addEventListener("pagehide", onPageHide);

    const idleTimer = window.setInterval(() => {
      const idle = Date.now() - lastActivity.current >= PRESENCE_IDLE_MS;
      if (idle) {
        void pingLastActive(true);
        return;
      }
      if (document.visibilityState === "visible") ping(false);
    }, 30_000);

    return () => {
      window.removeEventListener("click", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("pointerdown", onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(idleTimer);
    };
  }, [userId, ping]);

  const value = useMemo<PresenceValue>(
    () => ({
      online: new Set(),
      getUserPresence(_presenceUserId, lastActiveAt, showActivityFlag) {
        return statusFromLastActive(lastActiveAt, showActivityFlag ?? showActivity);
      },
    }),
    [showActivity],
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}
