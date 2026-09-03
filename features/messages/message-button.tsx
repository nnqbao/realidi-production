"use client";

import { useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { openDmAndRedirect } from "./actions";

export function MessageButton({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => openDmAndRedirect(userId))}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium"
    >
      <MessageCircle className="h-4 w-4" />
      Nhắn tin
    </button>
  );
}
