"use client";

import { useState, useTransition } from "react";
import { hidePostAndSimilar } from "@/features/safety/actions";
import { ReportButton } from "@/features/social/report-button";
import { toast } from "sonner";

export function PostSafetyMenu({
  postId,
  authorId,
  currentUserId,
}: {
  postId: string;
  authorId: string;
  currentUserId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  if (!currentUserId || currentUserId === authorId) return null;

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex size-10 items-center justify-center rounded-xl text-[#6F7480] hover:bg-brand/4"
        aria-label="Tùy chọn bài viết"
        onClick={() => setOpen((v) => !v)}
      >
        ···
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-2xl border border-subtle bg-surface p-2 shadow-[var(--shadow-card)]">
          <button
            type="button"
            className="flex min-h-10 w-full items-center rounded-xl px-3 text-left text-sm hover:bg-brand/4"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await hidePostAndSimilar(postId);
                toast.success("Đã ẩn bài viết này khỏi bảng tin của bạn.");
                setOpen(false);
              })
            }
          >
            Ẩn bài viết
          </button>
          <ReportButton targetType="post" targetId={postId} />
        </div>
      ) : null}
    </div>
  );
}
