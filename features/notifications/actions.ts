"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { requireUser } from "@/lib/auth/session";
import { convexMutation } from "@/lib/convex/server";
import type { NotificationKind } from "./keys";

/** Message and social notifications are written in-transaction via convex/_lib/notify. */
export async function insertNotification(input: {
  userId: string;
  actorId: string;
  type: NotificationKind;
  postId?: string | null;
  commentId?: string | null;
  conversationId?: string | null;
  invitationId?: string | null;
  messageId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  void input;
  return { id: null as string | null, duplicate: false };
}

export async function markNotificationRead(id: string) {
  await requireUser();
  try {
    await convexMutation(api.notifications.markRead, { id: id as Id<"notifications"> });
  } catch {
    return { error: "NOT_FOUND" };
  }
  revalidatePath("/notifications");
  return { ok: true as const };
}

export async function markAllNotificationsRead() {
  await requireUser();
  await convexMutation(api.notifications.markAllRead, {});
  revalidatePath("/notifications");
  return { ok: true as const };
}
