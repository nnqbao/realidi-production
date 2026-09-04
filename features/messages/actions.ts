"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { requireUser } from "@/lib/auth/session";
import { convexMutation, convexQueryAuthed } from "@/lib/convex/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { recordProductEvent, submitReport } from "@/features/social/actions";
import type { Json } from "@/types/database";
import type { ChatKind, InviteStatus } from "./types";
import {
  getAttachablePlaces as getAttachablePlacesQuery,
  getAttachablePosts as getAttachablePostsQuery,
  getConversationPeer as getConversationPeerQuery,
  getConversationShared as getConversationSharedQuery,
  getHydratedMessage as getHydratedMessageQuery,
  getUnreadMessageCount as getUnreadMessageCountQuery,
  listConversations as listConversationsQuery,
  listMessages as listMessagesQuery,
  searchMessageablePeople as searchMessageablePeopleQuery,
} from "./queries";

export async function listConversations() {
  return listConversationsQuery();
}
export async function listMessages(conversationId: string, cursor?: string | null) {
  return listMessagesQuery(conversationId, cursor);
}
export async function getConversationPeer(conversationId: string) {
  return getConversationPeerQuery(conversationId);
}
export async function getUnreadMessageCount() {
  return getUnreadMessageCountQuery();
}
export async function searchMessageablePeople(query: string) {
  return searchMessageablePeopleQuery(query);
}
export async function getAttachablePlaces() {
  return getAttachablePlacesQuery();
}
export async function getAttachablePosts() {
  return getAttachablePostsQuery();
}
export async function getConversationShared(conversationId: string) {
  return getConversationSharedQuery(conversationId);
}
export async function getHydratedMessage(id: string) {
  return getHydratedMessageQuery(id);
}

export async function generateMessageUploadUrlAction() {
  await requireUser();
  return await convexMutation(api.files.generateUploadUrl, { purpose: "message" });
}

export async function finalizeMessageMediaAction(input: {
  storageId: string;
  mimeType: string;
  byteSize: number;
}) {
  await requireUser();
  return await convexMutation(api.files.finalize, {
    storageId: input.storageId as Id<"_storage">,
    purpose: "message",
    mimeType: input.mimeType,
    byteSize: input.byteSize,
  });
}

export async function getOrCreateConversation(otherUserId: string) {
  const { user } = await requireUser();
  if (otherUserId === user.id) throw new Error("NO_SELF_DM");
  try {
    const id = await convexMutation(api.messages.getOrCreateDirect, {
      userId: otherUserId as Id<"profiles">,
    });
    await recordProductEvent("conversation_started", { conversation_id: id });
    revalidatePath("/messages");
    return id as string;
  } catch (error) {
    const data = (error as { data?: { message?: string } }).data;
    if (data?.message === "BLOCKED" || data?.message === "NO_SELF_DM") {
      throw new Error(data.message);
    }
    throw new Error("DM_FAILED");
  }
}

export async function openDmAndRedirect(userId: string) {
  const id = await getOrCreateConversation(userId);
  redirect(`/messages/${id}`);
}

function flatPayload(payload?: Json): Record<string, string | number | boolean | null> | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  return Object.fromEntries(
    Object.entries(payload as Record<string, unknown>)
      .filter(([, value]) => value === null || ["string", "number", "boolean"].includes(typeof value))
      .map(([key, value]) => [key, value as string | number | boolean | null]),
  );
}

export async function sendMessage(input: {
  conversationId: string;
  body?: string | null;
  kind?: ChatKind;
  payload?: Json;
  clientId?: string | null;
  replyToMessageId?: string | null;
}) {
  const { user } = await requireUser();
  if (!rateLimit(`msg:${user.id}`, 80)) throw new Error("RATE_LIMIT");
  const saved = await convexMutation(api.messages.send, {
    conversationId: input.conversationId as Id<"conversations">,
    body: input.body ?? undefined,
    kind: input.kind,
    payload: flatPayload(input.payload),
    clientId: input.clientId ?? undefined,
    replyToMessageId: input.replyToMessageId
      ? (input.replyToMessageId as Id<"messages">)
      : undefined,
  });
  await recordProductEvent("message_sent", {
    conversation_id: input.conversationId,
    kind: input.kind ?? "text",
  });
  if (input.kind === "image") await recordProductEvent("image_message_sent", { conversation_id: input.conversationId });
  if (input.kind === "post") {
    await recordProductEvent("shared_post_sent", {
      post_id: String((input.payload as { postId?: string })?.postId ?? "") || null,
    });
  }
  if (input.kind === "place") {
    await recordProductEvent("shared_place_sent", {
      place_id: String((input.payload as { placeId?: string })?.placeId ?? "") || null,
    });
  }
  if (input.kind === "profile") {
    await recordProductEvent("shared_profile_sent", {
      username: String((input.payload as { username?: string })?.username ?? "") || null,
    });
  }
  if (input.replyToMessageId) await recordProductEvent("message_replied", { conversation_id: input.conversationId });
  return saved as import("./types").ChatMessage;
}

export async function shareEntityToUser(input: {
  userId: string;
  kind: "post" | "place" | "profile" | "invite";
  payload: Record<string, string | null | undefined>;
  note?: string | null;
}) {
  const conversationId = await getOrCreateConversation(input.userId);
  await sendMessage({
    conversationId,
    body: input.note ?? null,
    kind: input.kind,
    payload: input.payload as Json,
  });
  if (input.kind === "post") await recordProductEvent("share_to_message", { post_id: input.payload.postId ?? null });
  if (input.kind === "place") await recordProductEvent("place_shared_to_message", { place_id: input.payload.placeId ?? null });
  return conversationId;
}

export async function inviteToPlace(input: {
  placeId: string;
  toUserId?: string;
  conversationId?: string;
  note?: string | null;
  suggestedDate?: string | null;
  suggestedTime?: string | null;
}) {
  await requireUser();
  const conversationId = await convexMutation(api.messages.inviteToPlace, {
    placeId: input.placeId as Id<"places">,
    toUserId: input.toUserId ? (input.toUserId as Id<"profiles">) : undefined,
    conversationId: input.conversationId
      ? (input.conversationId as Id<"conversations">)
      : undefined,
    note: input.note ?? undefined,
    suggestedDate: input.suggestedDate ?? undefined,
    suggestedTime: input.suggestedTime ?? undefined,
  });
  await recordProductEvent("experience_invite_sent", { place_id: input.placeId });
  await recordProductEvent("invite_to_place", { place_id: input.placeId });
  return conversationId as string;
}

export async function respondToInvite(input: { invitationId: string; messageId: string; status: InviteStatus }) {
  await requireUser();
  await convexMutation(api.messages.respondToInvite, {
    invitationId: input.invitationId as Id<"place_invitations">,
    messageId: input.messageId as Id<"messages">,
    status: input.status,
  });
  if (input.status === "accepted") await recordProductEvent("experience_invite_accepted");
  if (input.status === "declined") await recordProductEvent("experience_invite_declined");
  revalidatePath("/messages");
}

export async function getShareRecipients(query?: string) {
  await requireUser();
  return await convexQueryAuthed(api.messages.shareRecipients, { query });
}

export async function markConversationRead(conversationId: string) {
  await requireUser();
  await convexMutation(api.messages.markRead, {
    conversationId: conversationId as Id<"conversations">,
  });
  await recordProductEvent("message_read", { conversation_id: conversationId });
}

export async function pingLastSeen() {
  await requireUser();
  await convexMutation(api.presence.heartbeat, {});
}

export async function toggleReaction(messageId: string, reaction: string) {
  await requireUser();
  return await convexMutation(api.messages.toggleReaction, {
    messageId: messageId as Id<"messages">,
    reaction,
  });
}

export async function editMessage(messageId: string, body: string) {
  await requireUser();
  await convexMutation(api.messages.edit, {
    messageId: messageId as Id<"messages">,
    body,
  });
}

export async function deleteMessage(messageId: string) {
  await requireUser();
  await convexMutation(api.messages.remove, {
    messageId: messageId as Id<"messages">,
  });
}

export async function toggleMute(conversationId: string) {
  await requireUser();
  return await convexMutation(api.messages.toggleMute, {
    conversationId: conversationId as Id<"conversations">,
  });
}

export async function blockUser(userId: string) {
  const { user } = await requireUser();
  if (user.id === userId) throw new Error("NO_SELF");
  await convexMutation(api.safety.block, { userId: userId as Id<"profiles"> });
  await recordProductEvent("user_blocked", { target_user_id: userId });
}

export async function unblockUser(userId: string) {
  await requireUser();
  await convexMutation(api.safety.unblock, { userId: userId as Id<"profiles"> });
}

export async function reportMessage(messageId: string) {
  await submitReport({ targetType: "message", targetId: messageId, reason: "other" });
  await recordProductEvent("message_reported", { message_id: messageId });
}

export async function reportUser(userId: string) {
  await submitReport({ targetType: "user", targetId: userId, reason: "other" });
}

export async function recordMessagesOpened() {
  await recordProductEvent("messages_opened");
}

export async function recordConversationOpened(conversationId: string) {
  await recordProductEvent("conversation_opened", { conversation_id: conversationId });
}

export async function setTyping(conversationId: string, sessionKey?: string) {
  await requireUser();
  await convexMutation(api.messages.setTyping, {
    conversationId: conversationId as Id<"conversations">,
    sessionKey: sessionKey ?? "default",
  });
}
