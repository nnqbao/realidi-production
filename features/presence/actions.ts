"use server";

import { api } from "@/convex/_generated/api";
import { convexMutation } from "@/lib/convex/server";
import { requireUser } from "@/lib/auth/session";
import { recordProductEvent } from "@/features/social/actions";

export async function pingLastActive(idle?: boolean) {
  const session = await requireUser().catch(() => null);
  if (!session) return;
  await convexMutation(api.presence.heartbeat, { idle: idle === true });
}

export async function setShowActivityStatus(enabled: boolean) {
  await requireUser();
  try {
    await convexMutation(api.profiles.setActivityStatus, { enabled });
  } catch {
    return { error: "SAVE_FAILED", enabled: !enabled };
  }
  try {
    await recordProductEvent(enabled ? "activity_status_enabled" : "activity_status_disabled");
  } catch {
    // Analytics is optional during the Convex auth cutover.
  }
  return { enabled };
}
