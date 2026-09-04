"use server";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { requireUser } from "@/lib/auth/session";
import { convexQueryAuthed } from "@/lib/convex/server";
import type { ConversationPreview, ProfileLite, ThreadPage } from "./types";

export async function listConversations(): Promise<ConversationPreview[]> {
  await requireUser();
  return (await convexQueryAuthed(api.messages.list, {})) as ConversationPreview[];
}

export async function getUnreadMessageCount() {
  const session = await requireUser().catch(() => null);
  if (!session) return 0;
  return await convexQueryAuthed(api.messages.unreadCount, {});
}

export async function getConversationPeer(conversationId: string) {
  await requireUser();
  return await convexQueryAuthed(api.messages.peer, {
    conversationId: conversationId as Id<"conversations">,
  });
}

export async function listMessages(conversationId: string, cursor?: string | null): Promise<ThreadPage> {
  await requireUser();
  return (await convexQueryAuthed(api.messages.thread, {
    conversationId: conversationId as Id<"conversations">,
    cursor: cursor ? Date.parse(cursor) : undefined,
  })) as ThreadPage;
}

export async function searchMessageablePeople(query: string) {
  await requireUser();
  return (await convexQueryAuthed(api.messages.searchPeople, { query })) as ProfileLite[];
}

export async function getAttachablePlaces() {
  await requireUser();
  return await convexQueryAuthed(api.messages.attachablePlaces, {});
}

export async function getAttachablePosts() {
  await requireUser();
  return await convexQueryAuthed(api.messages.attachablePosts, {});
}

export async function getConversationShared(conversationId: string) {
  await requireUser();
  return (await convexQueryAuthed(api.messages.shared, {
    conversationId: conversationId as Id<"conversations">,
  })) as import("./types").ChatMessage[];
}

export async function getHydratedMessage(id: string) {
  await requireUser();
  return await convexQueryAuthed(api.messages.byId, { messageId: id as Id<"messages"> });
}

export async function hydrateMessages() {
  return [];
}
