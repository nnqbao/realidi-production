"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { deleteComment } from "@/features/social/actions";

export type CommentItem = {
  id: string;
  body: string;
  author_id: string;
  parent_id: string | null;
  place_id: string | null;
  profiles: { username: string; display_name: string } | null;
  attached?: { slug: string; name: string; district: string | null } | null;
};

export function CommentsSection({
  comments,
  currentUserId,
}: {
  comments: CommentItem[];
  currentUserId?: string | null;
  highlightId?: string | null;
}) {
  const missingRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const hash = window.location.hash;
    const id = hash.startsWith("#comment-") ? hash.slice("#comment-".length) : "";
    const target = id ? document.getElementById(`comment-${id}`) : null;
    if (missingRef.current) {
      missingRef.current.hidden = !(id && !target);
    }
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [comments]);

  return (
    <>
      <p ref={missingRef} hidden className="mb-3 rounded-2xl bg-brand/4 px-3 py-2 text-sm text-[#6F7480]" role="status">
        Bình luận này không còn tồn tại.
      </p>
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có bình luận.</p>
      ) : null}
      <ul className="mt-3 space-y-3">
        {comments.map((comment) => (
          <li
            key={comment.id}
            id={`comment-${comment.id}`}
            className={cn(
              "rounded-2xl bg-brand/4 p-3 text-sm transition-colors target:bg-brand/8 target:ring-2 target:ring-brand/30",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <Link href={`/user/${comment.profiles?.username}`} className="font-medium">
                {comment.profiles?.display_name}
              </Link>
              {currentUserId === comment.author_id ? (
                <form
                  action={async () => {
                    await deleteComment(comment.id);
                  }}
                >
                  <Button type="submit" variant="ghost" size="sm">
                    Xóa
                  </Button>
                </form>
              ) : null}
            </div>
            <p className="mt-1">{comment.body}</p>
            {comment.attached ? (
              <Link href={`/place/${comment.attached.slug}`} className="mt-2 block rounded-xl bg-white px-3 py-2 text-sm">
                <span className="font-medium">{comment.attached.name}</span>
                {comment.attached.district ? (
                  <span className="block text-xs text-muted-foreground">{comment.attached.district}</span>
                ) : null}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
