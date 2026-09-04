"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { pingLastActive } from "./actions";
import { mergePresenceTracks, resolvePresence } from "./format";
import {
  LAST_ACTIVE_PING_MS,
  PRESENCE_IDLE_MS,
  PRESENCE_TRACK_THROTTLE_MS,
  type PresenceSnapshot,
} from "./types";
import { PRESENCE_CHANNEL, presenceTrackKey } from "@/features/realtime/reconnect";
import { realtimeLog } from "@/features/realtime/log";
import type { TrackedPresence } from "./format";

type PresenceValue = {
  getUserPresence: (userId: string, lastActiveAt?: string | null, showActivity?: boolean | null) => PresenceSnapshot;
  online: Set<string>;
};

const PresenceContext = createContext<PresenceValue>({
  getUserPresence: (_id, lastActiveAt, showActivity) =>
    resolvePresence({ connected: false, lastActiveAt, showActivity }),
  online: new Set(),
});

export function usePresence() {
  return useContext(PresenceContext);
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
  const [tracks, setTracks] = useState<Record<string, TrackedPresence>>({});
  const lastTrack = useRef(0);
  const lastActivity = useRef(0);
  const lastPing = useRef(0);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const showActivityRef = useRef(showActivity);
  const userIdRef = useRef(userId);
  const [tabId] = useState(() => crypto.randomUUID());

  const pushTrack = useCallback((idle: boolean) => {
    const channel = channelRef.current;
    const id = userIdRef.current;
    if (!channel || !id) return;
    const now = Date.now();
    if (!idle && now - lastTrack.current < PRESENCE_TRACK_THROTTLE_MS) return;
    lastTrack.current = now;
    void channel.track({ at: now, idle, visible: showActivityRef.current });
  }, []);

  const ping = useCallback(() => {
    const now = Date.now();
    if (now - lastPing.current < LAST_ACTIVE_PING_MS) return;
    lastPing.current = now;
    void pingLastActive();
  }, []);

  useEffect(() => {
    showActivityRef.current = showActivity;
    userIdRef.current = userId;
  }, [showActivity, userId]);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) return;
    const id = userId;
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    function applySync(target: NonNullable<typeof channel>) {
      const state = target.presenceState<TrackedPresence>();
      setTracks(mergePresenceTracks(state));
    }

    function subscribe() {
      if (cancelled) return;
      realtimeLog("connecting");
      const next = supabase.channel(PRESENCE_CHANNEL, {
        config: { presence: { key: presenceTrackKey(id, tabId) } },
      });
      channel = next;
      next
        .on("presence", { event: "sync" }, () => applySync(next))
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            channelRef.current = next;
            lastActivity.current = Date.now();
            void next.track({ at: Date.now(), idle: false, visible: showActivityRef.current });
            ping();
            realtimeLog("subscribed");
            return;
          }
          if (status === "TIMED_OUT" || status === "CHANNEL_ERROR") {
            realtimeLog("reconnect attempt");
          }
        });
    }

    subscribe();

    const onActivity = () => {
      lastActivity.current = Date.now();
      pushTrack(false);
    };
    window.addEventListener("click", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("pointerdown", onActivity, { passive: true });

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        lastActivity.current = Date.now();
        pushTrack(false);
        ping();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onOnline = () => {
      if (!supabase.realtime.isConnected() && !supabase.realtime.isConnecting()) {
        realtimeLog("reconnect attempt");
        supabase.realtime.connect();
      }
    };
    window.addEventListener("online", onOnline);

    const onPageHide = () => {
      void channel?.untrack();
      void pingLastActive();
    };
    window.addEventListener("pagehide", onPageHide);

    const idleTimer = window.setInterval(() => {
      const idle = Date.now() - lastActivity.current >= PRESENCE_IDLE_MS;
      pushTrack(idle);
      if (!idle && document.visibilityState === "visible") ping();
    }, 30_000);

    return () => {
      cancelled = true;
      window.removeEventListener("click", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("pointerdown", onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(idleTimer);
      channelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, tabId, ping, pushTrack]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !userId) return;
    void channel.track({ at: Date.now(), idle: false, visible: showActivity });
  }, [showActivity, userId]);

  const value = useMemo<PresenceValue>(() => {
    const online = new Set(
      Object.entries(tracks)
        .filter(([, meta]) => meta.visible !== false && !meta.idle)
        .map(([id]) => id),
    );
    return {
      online,
      getUserPresence(presenceUserId, lastActiveAt, showActivityFlag) {
        const meta = tracks[presenceUserId];
        return resolvePresence({
          connected: Boolean(meta) && meta.visible !== false,
          lastTrackAt: meta?.at ?? null,
          idle: meta?.idle,
          lastActiveAt,
          showActivity: meta?.visible === false ? false : showActivityFlag,
        });
      },
    };
  }, [tracks]);

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}
