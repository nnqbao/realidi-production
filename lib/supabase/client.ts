import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { realtimeLog } from "@/features/realtime/log";
import { nextReconnectDelay } from "@/features/realtime/reconnect";
import { AUTH_COOKIE_OPTIONS } from "./cookies";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;
let authBound = false;

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (typeof window === "undefined") {
    return createBrowserClient<Database>(url, key);
  }
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(url, key, {
      isSingleton: true,
      cookieOptions: AUTH_COOKIE_OPTIONS,
      realtime: {
        heartbeatIntervalMs: 20_000,
        timeout: 20_000,
        disconnectOnEmptyChannelsAfterMs: 120_000,
        reconnectAfterMs: (tries) => nextReconnectDelay(tries - 1),
        accessToken: async () => {
          const current = browserClient;
          if (!current) return null;
          const { data } = await current.auth.getSession();
          return data.session?.access_token ?? null;
        },
      },
    });
    bindRealtimeAuth(browserClient);
  }
  return browserClient;
}

function bindRealtimeAuth(client: ReturnType<typeof createBrowserClient<Database>>) {
  if (authBound) return;
  authBound = true;
  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      if (session?.access_token) {
        void client.realtime.setAuth(session.access_token);
      }
    }
    if (event === "SIGNED_OUT") {
      void client.realtime.disconnect();
      realtimeLog("disconnected");
    }
  });
}
