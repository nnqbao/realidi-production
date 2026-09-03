"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { NotificationKind } from "./keys";
import { notificationIdempotencyKey } from "./keys";

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
  if (input.userId === input.actorId) return { id: null as string | null, duplicate: false };
  const supabase = await createServerSupabase();
  const { data: blocked } = await supabase.rpc("is_blocked_with", { other: input.userId });
  if (blocked) return { id: null as string | null, duplicate: false };
  if (input.type === "message" && !input.messageId) {
    return { id: null as string | null, duplicate: false };
  }
  const key = notificationIdempotencyKey({
    type: input.type,
    actorId: input.actorId,
    recipientId: input.userId,
    postId: input.postId,
    commentId: input.commentId,
    conversationId: input.conversationId,
    invitationId: input.invitationId,
    messageId: input.messageId,
  });
  const metadata = {
    ...(input.metadata ?? {}),
    ...(input.conversationId ? { conversation_id: input.conversationId } : {}),
    ...(input.postId ? { post_id: input.postId } : {}),
    ...(input.commentId ? { comment_id: input.commentId } : {}),
    ...(input.messageId ? { message_id: input.messageId } : {}),
  };
  const { data, error } = await supabase.rpc("notify_event", {
    p_user_id: input.userId,
    p_actor_id: input.actorId,
    p_type: input.type,
    p_post_id: input.postId ?? undefined,
    p_comment_id: input.commentId ?? undefined,
    p_idempotency_key: key ?? undefined,
    p_metadata: metadata,
  });
  if (error) return { id: null as string | null, duplicate: false, error: error.message };
  return { id: (data as string | null) ?? null, duplicate: false };
}

export async function markNotificationRead(id: string) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return { error: error.message };
  revalidatePath("/notifications");
  return { ok: true as const };
}

export async function markAllNotificationsRead() {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (error) return { error: error.message };
  revalidatePath("/notifications");
  return { ok: true as const };
}
