"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { feedReasonCopy } from "@/lib/feed-ranking";
import { recordProductEvent } from "@/features/social/actions";
import type { FeedReason } from "@/types/database";

export function WhyThisPost({
  postId,
  reasons,
  authorName,
  moodName,
}: {
  postId: string;
  reasons: FeedReason[];
  authorName?: string | null;
  moodName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  if (reasons.length === 0) return null;
  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex size-9 items-center justify-center rounded-xl text-brand/50 hover:bg-brand/4 hover:text-brand"
        aria-label="Tùy chọn bài viết"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) {
            void recordProductEvent("why_this_post_opened", { post_id: postId, reason: reasons[0] });
          }
        }}
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-2xl border border-subtle bg-surface p-3 text-sm shadow-[var(--shadow-card)]">
          <p className="text-xs font-medium text-brand">Tại sao tôi thấy bài này?</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {reasons.map((reason) => (
              <li key={reason}>{feedReasonCopy(reason, { authorName, moodName })}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
