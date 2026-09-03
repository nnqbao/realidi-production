"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { realtimeLog } from "./log";
import { useRealtimeConnection } from "./connection";

export function useRealtimeChannel(
  channelName: string | null,
  configure: (channel: RealtimeChannel) => RealtimeChannel,
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const configureRef = useRef(configure);
  const { status, showReconnect, connected } = useRealtimeConnection();

  useEffect(() => {
    configureRef.current = configure;
  }, [configure]);

  useEffect(() => {
    if (!channelName) return;
    const supabase = createClient();
    realtimeLog("connecting");
    const channel = configureRef.current(
      supabase.channel(channelName, { config: { broadcast: { self: false } } }),
    );
    channelRef.current = channel;
    channel.subscribe((statusName) => {
      if (statusName === "SUBSCRIBED") realtimeLog("subscribed");
      else if (statusName === "CLOSED") realtimeLog("disconnected");
      else if (statusName === "CHANNEL_ERROR" || statusName === "TIMED_OUT") {
        realtimeLog("reconnect attempt");
      }
    });

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [channelName]);

  return { channelRef, showReconnect, status, connected };
}
