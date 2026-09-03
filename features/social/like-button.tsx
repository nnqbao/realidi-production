"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { toggleLike } from "@/features/social/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function LikeButton({
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
  const [liked, setLiked] = useState(initial);
  const [n, setN] = useState(count);
  const [pending, start] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 text-sm text-brand/68 hover:text-brand",
        liked && "text-brand",
      )}
      disabled={pending}
      aria-pressed={liked}
      aria-label="Thích"
      onClick={() => {
        if (!signedIn) {
          router.push(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        const prevLiked = liked;
        const prevN = n;
        setLiked(!prevLiked);
        setN(prevN + (prevLiked ? -1 : 1));
        start(async () => {
          try {
            const result = await toggleLike(postId);
            setLiked(result.liked);
          } catch {
            setLiked(prevLiked);
            setN(prevN);
            toast.error("Không thích được bài viết. Thử lại sau.");
          }
        });
      }}
    >
      <Heart className={cn("size-5", liked && "fill-current")} />
      <span>Thích</span>
      {n > 0 ? <span>{n}</span> : null}
    </button>
  );
}
