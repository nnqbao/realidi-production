"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addComment } from "@/features/social/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function CommentForm({
  postId,
  places = [],
  allowPlace = false,
}: {
  postId: string;
  places?: { id: string; name: string; district: string | null }[];
  allowPlace?: boolean;
}) {
  const [pending, start] = useTransition();
  const [placeId, setPlaceId] = useState("");
  const router = useRouter();
  return (
    <form
      className="mt-4 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const form = e.currentTarget;
        const body = String(new FormData(form).get("body") ?? "");
        start(async () => {
          try {
            await addComment(postId, body, null, placeId || null);
            form.reset();
            setPlaceId("");
            router.refresh();
          } catch {
            toast.error("Không gửi được bình luận. Đăng nhập rồi thử lại.");
          }
        });
      }}
    >
      <Textarea name="body" required maxLength={2000} placeholder={allowPlace ? "Gợi ý một nơi, hoặc trả lời…" : "Viết bình luận"} />
      {allowPlace && places.length > 0 ? (
        <select
          className="min-h-11 w-full rounded-xl border border-brand/14 bg-surface px-3 text-sm text-brand"
          value={placeId}
          onChange={(e) => setPlaceId(e.target.value)}
          aria-label="Gắn địa điểm"
        >
          <option value="">Không gắn địa điểm</option>
          {places.map((place) => (
            <option key={place.id} value={place.id}>
              {place.name}
              {place.district ? ` · ${place.district}` : ""}
            </option>
          ))}
        </select>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Đang gửi…" : "Gửi"}
      </Button>
    </form>
  );
}
