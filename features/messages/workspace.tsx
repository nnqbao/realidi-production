"use client";

import { usePathname } from "next/navigation";
import { ConversationList } from "./conversation-list";
import { cn } from "@/lib/utils";
import type { ConversationPreview } from "./types";
import type { ReactNode } from "react";

export function MessagesWorkspace({
  conversations,
  children,
}: {
  userId: string;
  conversations: ConversationPreview[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const activeId = pathname.startsWith("/messages/") && pathname !== "/messages" ? pathname.split("/")[2] : undefined;
  const onThread = Boolean(activeId);

  return (
      <div className={cn("flex min-h-0 bg-background", onThread ? "h-dvh" : "h-[calc(100dvh-3.5rem)] pb-16 md:h-dvh md:pb-0")}>
        <div className={onThread ? "hidden w-[min(100%,380px)] shrink-0 md:flex md:w-[340px] lg:w-[380px]" : "flex w-full shrink-0 md:w-[340px] lg:w-[380px]"}>
          <div className="h-full w-full">
            <ConversationList conversations={conversations} activeId={activeId} />
          </div>
        </div>
        <div className={onThread ? "flex min-w-0 flex-1 flex-col" : "hidden min-w-0 flex-1 md:flex"}>
          {children}
        </div>
      </div>
  );
}
