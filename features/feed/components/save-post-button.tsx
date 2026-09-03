"use client";

import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { toggleSavePost } from "@/features/social/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SavePostButton({
  postId,
  initial = false,
  count = 0,
  signedIn = true,
}: {
  postId: string;
  initial?: boolean;
  count?: number;
  signedIn?: boolean;
}) {
  const [saved, setSaved] = useState(initial);
  const [n, setN] = useState(count);
  const [pending, start] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 text-sm text-brand/68 hover:text-brand",
        saved && "text-brand",
      )}
      disabled={pending}
      aria-pressed={saved}
      aria-label="Lưu bài viết"
      onClick={() => {
        if (!signedIn) {
          router.push(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        start(async () => {
          try {
            const result = await toggleSavePost(postId);
            setSaved(result.saved);
            setN((prev) => prev + (result.saved ? 1 : -1));
          } catch {
            toast.error("Không lưu được bài viết. Thử lại sau.");
          }
        });
      }}
    >
      <Bookmark className={cn("size-5", saved && "fill-current")} />
      <span>Lưu</span>
      {n > 0 ? <span>{n}</span> : null}
    </button>
  );
}
