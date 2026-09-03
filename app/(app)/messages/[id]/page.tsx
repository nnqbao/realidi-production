import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getConversationPeer, listMessages, recordConversationOpened } from "@/features/messages/actions";
import { ChatThread } from "@/features/messages/thread";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser().catch(() => null);
  if (!session) notFound();
  const { id } = await params;
  const peer = await getConversationPeer(id).catch(() => null);
  if (!peer?.profile) notFound();
  const thread = await listMessages(id);
  await recordConversationOpened(id).catch(() => undefined);
  return (
    <ChatThread
      key={id}
      conversationId={id}
      currentUserId={session.user.id}
      peer={peer.profile}
      initial={thread}
    />
  );
}
