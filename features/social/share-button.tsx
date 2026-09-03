"use client";

import { toast } from "sonner";
import { Share } from "lucide-react";
import { recordShare } from "@/features/social/actions";

export function ShareButton({ path, postId, placeId }: { path: string; postId?: string; placeId?: string }) {
  return (
    <button
      type="button"
      className="inline-flex min-h-10 items-center gap-1.5 text-sm text-brand/68 hover:text-brand"
      aria-label="Chia sẻ"
      onClick={async () => {
        const url = `${window.location.origin}${path}`;
        await navigator.clipboard.writeText(url);
        await recordShare({ postId, placeId });
        toast.success("Đã sao chép liên kết");
      }}
    >
      <Share className="size-5" />
      <span>Chia sẻ</span>
    </button>
  );
}
