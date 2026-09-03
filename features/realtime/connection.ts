"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { realtimeLog } from "./log";
import { shouldShowReconnect } from "./reconnect";
import type { RealtimeStatus } from "./log";

let monitorCount = 0;
let pollTimer: number | null = null;
const listeners = new Set<(status: RealtimeStatus, connected: boolean) => void>();
let lastStatus: RealtimeStatus = "connecting";

function readStatus(): RealtimeStatus {
  const realtime = createClient().realtime;
  if (realtime.isConnected()) return "connected";
  if (realtime.isConnecting()) return lastStatus === "connected" ? "reconnecting" : "connecting";
  if (realtime.isDisconnecting()) return "reconnecting";
  return lastStatus === "connecting" ? "connecting" : "disconnected";
}

function logTransition(previous: RealtimeStatus, next: RealtimeStatus) {
  if (next === "connected" && (previous === "reconnecting" || previous === "disconnected" || previous === "failed")) {
    realtimeLog("reconnected");
    return;
  }
  if (next === "connected") realtimeLog("connected");
  else if (next === "connecting") realtimeLog("connecting");
  else if (next === "reconnecting") realtimeLog("reconnect attempt");
  else realtimeLog("disconnected");
}

function emit(status: RealtimeStatus) {
  if (status === lastStatus) return;
  const previous = lastStatus;
  lastStatus = status;
  logTransition(previous, status);
  const connected = status === "connected";
  listeners.forEach((listener) => listener(status, connected));
}

function startMonitor() {
  monitorCount += 1;
  if (pollTimer != null) return;
  pollTimer = window.setInterval(() => {
    emit(readStatus());
  }, 1000);
}

function stopMonitor() {
  monitorCount = Math.max(0, monitorCount - 1);
  if (monitorCount > 0 || pollTimer == null) return;
  window.clearInterval(pollTimer);
  pollTimer = null;
}

export function useRealtimeConnection() {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [disconnectedSince, setDisconnectedSince] = useState<number | null>(null);

  useEffect(() => {
    startMonitor();
    const listener = (next: RealtimeStatus) => {
      setStatus(next);
      if (next === "connected") setDisconnectedSince(null);
      else if (next === "reconnecting" || next === "disconnected" || next === "failed") {
        setDisconnectedSince((prev) => prev ?? Date.now());
      }
    };
    listeners.add(listener);
    const initial = readStatus();
    queueMicrotask(() => listener(initial));
    return () => {
      listeners.delete(listener);
      stopMonitor();
    };
  }, []);

  const showReconnect = shouldShowReconnect(disconnectedSince) && status !== "connected";
  return { status, showReconnect, connected: status === "connected" };
}

export function useDidReconnect(connected: boolean, onReconnect: () => void) {
  const seenConnected = useRef(false);
  useEffect(() => {
    if (!connected) return;
    if (!seenConnected.current) {
      seenConnected.current = true;
      return;
    }
    onReconnect();
  }, [connected, onReconnect]);
}
