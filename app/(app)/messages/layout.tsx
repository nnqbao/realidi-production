import type { ReactNode } from "react";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { listConversations, recordMessagesOpened } from "@/features/messages/actions";
import { MessagesWorkspace } from "@/features/messages/workspace";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";

export default async function MessagesLayout({ children }: { children: ReactNode }) {
  const session = await getSessionUser().catch(() => null);
  if (!session) {
    return (
      <EmptyState
        title="Đăng nhập để nhắn tin"
        description="Tin nhắn trên Realidi giúp bạn hỏi thêm về một trải nghiệm hoặc rủ đi cùng."
        action={
          <Button asChild>
            <Link href="/login?next=/messages">Đăng nhập</Link>
          </Button>
        }
      />
    );
  }
  const conversations = await listConversations().catch(() => []);
  await recordMessagesOpened().catch(() => undefined);
  return (
    <MessagesWorkspace userId={session.user.id} conversations={conversations}>
      {children}
    </MessagesWorkspace>
  );
}
