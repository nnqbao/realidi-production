"use client";

import type { ReactNode } from "react";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { getConvexClient } from "@/lib/convex/client";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={getConvexClient()}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
