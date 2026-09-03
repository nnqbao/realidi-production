"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";
import { recordProductEvent, submitReport } from "@/features/social/actions";
import { insertNotification } from "@/features/notifications/actions";
import type { Json } from "@/types/database";
import type { ChatKind, InviteStatus } from "./types";
import {
  hydrateMessages,
  listConversations as listConversationsQuery,
  listMessages as listMessagesQuery,
  getConversationPeer as getConversationPeerQuery,
  getUnreadMessageCount as getUnreadMessageCountQuery,
  searchMessageablePeople as searchMessageablePeopleQuery,
  getAttachablePlaces as getAttachablePlacesQuery,
  getAttachablePosts as getAttachablePostsQuery,
  getConversationShared as getConversationSharedQuery,
  getHydratedMessage as getHydratedMessageQuery,
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

async function assertMember(conversationId: string, userId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("conversation_participants")
    .select("user_id, muted, last_read_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("FORBIDDEN");
  return data;
}

async function peerId(conversationId: string, userId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("conversation_participants")
    .select("user_id, muted, last_read_at")
    .eq("conversation_id", conversationId);
  return (data ?? []).find((row) => row.user_id !== userId) ?? null;
}

async function assertNotBlocked(otherUserId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("is_blocked_with", { other: otherUserId });
  if (error) return;
  if (data) throw new Error("BLOCKED");
}

export async function getOrCreateConversation(otherUserId: string) {
  const { user } = await requireUser();
  if (otherUserId === user.id) throw new Error("NO_SELF_DM");
  await assertNotBlocked(otherUserId);
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("get_or_create_dm", { other_user_id: otherUserId });
  if (error || !data) throw new Error(error?.message ?? "DM_FAILED");
  await recordProductEvent("conversation_started", { conversation_id: data as string });
  revalidatePath("/messages");
  return data as string;
}

export async function openDmAndRedirect(userId: string) {
  const id = await getOrCreateConversation(userId);
  redirect(`/messages/${id}`);
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
  await assertMember(input.conversationId, user.id);
  const other = await peerId(input.conversationId, user.id);
  if (other) await assertNotBlocked(other.user_id);
  const supabase = await createServerSupabase();
  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      sender_id: user.id,
      body: input.body?.trim() || null,
      kind: input.kind ?? "text",
      payload: input.payload ?? {},
      client_id: input.clientId ?? null,
      reply_to_message_id: input.replyToMessageId ?? null,
    })
    .select("id, conversation_id, sender_id, body, kind, payload, created_at, deleted_at, edited_at, client_id, reply_to_message_id")
    .single();
  if (error || !message) throw new Error(error?.message ?? "SEND_FAILED");

  const recentlyActive = other?.last_read_at && Date.now() - new Date(other.last_read_at).getTime() < 20_000;
  if (other && !other.muted && !recentlyActive) {
    await insertNotification({
      userId: other.user_id,
      actorId: user.id,
      type: "message",
      conversationId: input.conversationId,
      messageId: message.id,
      metadata: { conversation_id: input.conversationId, message_id: message.id },
    });
  }

  await recordProductEvent("message_sent", {
    conversation_id: input.conversationId,
    kind: input.kind ?? "text",
  });
  if (input.kind === "image") await recordProductEvent("image_message_sent", { conversation_id: input.conversationId });
  if (input.kind === "post") await recordProductEvent("shared_post_sent", { post_id: String((input.payload as { postId?: string })?.postId ?? "") || null });
  if (input.kind === "place") await recordProductEvent("shared_place_sent", { place_id: String((input.payload as { placeId?: string })?.placeId ?? "") || null });
  if (input.kind === "profile") await recordProductEvent("shared_profile_sent", { username: String((input.payload as { username?: string })?.username ?? "") || null });
  if (input.replyToMessageId) await recordProductEvent("message_replied", { conversation_id: input.conversationId });

  const [hydrated] = await hydrateMessages([message], user.id);
  return hydrated;
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
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const { data: place } = await supabase
    .from("places")
    .select("id, name, slug, district")
    .eq("id", input.placeId)
    .maybeSingle();
  if (!place) throw new Error("PLACE");
  const conversationId = input.conversationId ?? (input.toUserId ? await getOrCreateConversation(input.toUserId) : null);
  if (!conversationId) throw new Error("NO_RECIPIENT");
  const other = await peerId(conversationId, user.id);
  if (!other) throw new Error("NO_PEER");
  const { data: invitation } = await supabase
    .from("place_invitations")
    .insert({
      place_id: input.placeId,
      from_user_id: user.id,
      to_user_id: other.user_id,
      conversation_id: conversationId,
      suggested_date: input.suggestedDate || null,
      suggested_time: input.suggestedTime ?? null,
      note: input.note ?? null,
      status: "pending",
    })
    .select("id")
    .single();
  await sendMessage({
    conversationId,
    body: input.note ?? null,
    kind: "invite",
    payload: {
      placeId: place.id,
      placeName: place.name,
      placeSlug: place.slug,
      placeDistrict: place.district,
      suggestedDate: input.suggestedDate ?? null,
      suggestedTime: input.suggestedTime ?? null,
      invitationId: invitation?.id ?? null,
      status: "pending",
      note: input.note ?? null,
    },
  });
  await recordProductEvent("experience_invite_sent", { place_id: input.placeId });
  await recordProductEvent("invite_to_place", { place_id: input.placeId });
  return conversationId;
}

export async function respondToInvite(input: { invitationId: string; messageId: string; status: InviteStatus }) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const { data: row } = await supabase
    .from("place_invitations")
    .select("id, to_user_id, conversation_id, place_id")
    .eq("id", input.invitationId)
    .maybeSingle();
  if (!row || row.to_user_id !== user.id) throw new Error("FORBIDDEN");
  await supabase
    .from("place_invitations")
    .update({ status: input.status, responded_at: new Date().toISOString() })
    .eq("id", input.invitationId);
  const { data: message } = await supabase.from("messages").select("payload").eq("id", input.messageId).maybeSingle();
  const payload = { ...((message?.payload as Record<string, unknown>) ?? {}), status: input.status };
  await supabase.from("messages").update({ payload }).eq("id", input.messageId);
  if (input.status === "accepted") await recordProductEvent("experience_invite_accepted", { place_id: row.place_id });
  if (input.status === "declined") await recordProductEvent("experience_invite_declined", { place_id: row.place_id });
  if (row.conversation_id) revalidatePath(`/messages/${row.conversation_id}`);
}

export async function getShareRecipients(query?: string) {
  const { listConversations, searchMessageablePeople } = await import("./queries");
  const conversations = await listConversations().catch(() => []);
  const seen = new Set<string>();
  const people: Array<{ id: string; username: string; display_name: string; avatar_path: string | null; source: string }> = [];
  for (const conv of conversations) {
    if (!conv.other || seen.has(conv.other.id)) continue;
    seen.add(conv.other.id);
    people.push({ ...conv.other, source: "recent" });
  }
  if (query && query.trim().length >= 2) {
    const found = await searchMessageablePeople(query);
    for (const profile of found) {
      if (seen.has(profile.id)) continue;
      seen.add(profile.id);
      people.push({ ...profile, source: "search" });
    }
  } else {
    const { user } = await requireUser();
    const supabase = await createServerSupabase();
    const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", user.id).limit(20);
    const followIds = (follows ?? []).map((row) => row.following_id);
    const { data: followProfiles } = followIds.length
      ? await supabase.from("profiles").select("id, username, display_name, avatar_path").in("id", followIds)
      : { data: [] };
    for (const profile of followProfiles ?? []) {
      if (seen.has(profile.id)) continue;
      seen.add(profile.id);
      people.push({ ...profile, source: "following" });
    }
  }
  return people.slice(0, 16);
}

export async function markConversationRead(conversationId: string) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  await recordProductEvent("message_read", { conversation_id: conversationId });
}

export async function pingLastSeen() {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const now = new Date().toISOString();
  await supabase.from("profiles").update({ last_seen_at: now, last_active_at: now }).eq("id", user.id);
}

export async function toggleReaction(messageId: string, reaction: string) {
  const { user } = await requireUser();
  const allowed = ["❤️", "👍", "😂", "😮", "😢"];
  if (!allowed.includes(reaction)) throw new Error("INVALID");
  const supabase = await createServerSupabase();
  const { data: existing } = await supabase
    .from("message_reactions")
    .select("reaction")
    .eq("message_id", messageId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing?.reaction === reaction) {
    await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", user.id);
    return { reaction: null };
  }
  await supabase.from("message_reactions").upsert({ message_id: messageId, user_id: user.id, reaction });
  await recordProductEvent("message_reaction_added", { message_id: messageId, reaction });
  return { reaction };
}

export async function editMessage(messageId: string, body: string) {
  const { user } = await requireUser();
  const trimmed = body.trim();
  if (trimmed.length < 1 || trimmed.length > 2000) throw new Error("INVALID");
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("messages").select("sender_id, kind").eq("id", messageId).maybeSingle();
  if (!data || data.sender_id !== user.id || data.kind !== "text") throw new Error("FORBIDDEN");
  await supabase.from("messages").update({ body: trimmed, edited_at: new Date().toISOString() }).eq("id", messageId);
}

export async function deleteMessage(messageId: string) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("messages").select("sender_id").eq("id", messageId).maybeSingle();
  if (!data || data.sender_id !== user.id) throw new Error("FORBIDDEN");
  await supabase.from("messages").update({ deleted_at: new Date().toISOString(), body: null }).eq("id", messageId);
}

export async function toggleMute(conversationId: string) {
  const { user } = await requireUser();
  const row = await assertMember(conversationId, user.id);
  const supabase = await createServerSupabase();
  await supabase
    .from("conversation_participants")
    .update({ muted: !row.muted })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  return { muted: !row.muted };
}

export async function blockUser(userId: string) {
  const { user } = await requireUser();
  if (user.id === userId) throw new Error("NO_SELF");
  const supabase = await createServerSupabase();
  await supabase.from("user_blocks").upsert({ blocker_id: user.id, blocked_id: userId });
  await recordProductEvent("user_blocked", { target_user_id: userId });
}

export async function unblockUser(userId: string) {
  const { user } = await requireUser();
  const supabase = await createServerSupabase();
  await supabase.from("user_blocks").delete().eq("blocker_id", user.id).eq("blocked_id", userId);
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

/** @deprecated Typing is ephemeral Broadcast. Kept as no-op for old clients. */
export async function setTyping(conversationId: string) {
  void conversationId;
}
