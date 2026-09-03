"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ChatAvatar } from "./avatar";
import { getConversationShared, toggleMute, blockUser, unblockUser, reportUser } from "./actions";
import type { ChatMessage, ProfileLite } from "./types";
import { cn } from "@/lib/utils";

export function ConversationInfo({
  open,
  onClose,
  conversationId,
  peer,
  muted,
  blockedByMe,
}: {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  peer: ProfileLite;
  muted: boolean;
  blockedByMe: boolean;
}) {
  const [tab, setTab] = useState<"media" | "places" | "posts">("media");
  const [items, setItems] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!open) return;
    void getConversationShared(conversationId).then(setItems).catch(() => setItems([]));
  }, [open, conversationId]);

  const media = items.filter((m) => m.kind === "image" && m.imageUrl);
  const places = items.filter((m) => m.kind === "place" || m.kind === "invite");
  const posts = items.filter((m) => m.kind === "post");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-5 pt-12" fullScreenMobile>
        <DialogTitle>Chi tiết</DialogTitle>
        <Link href={`/user/${peer.username}`} className="mt-4 flex items-center gap-3">
          <ChatAvatar name={peer.display_name} src={peer.avatar_path} size={56} />
          <span>
            <span className="block font-semibold">{peer.display_name}</span>
            <span className="text-sm text-[#6F7480]">@{peer.username}</span>
            {peer.bio ? <span className="mt-1 line-clamp-2 block text-sm text-[#6F7480]">{peer.bio}</span> : null}
          </span>
        </Link>
        <div className="mt-5 flex gap-1 border-b border-brand/8">
          {(["media", "places", "posts"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn("px-3 py-2 text-sm", tab === id ? "border-b-2 border-brand font-semibold" : "text-[#6F7480]")}
            >
              {id === "media" ? "Ảnh" : id === "places" ? "Địa điểm" : "Bài viết"}
            </button>
          ))}
        </div>
        <div className="mt-3 max-h-64 overflow-y-auto">
          {tab === "media" ? (
            media.length ? (
              <div className="grid grid-cols-3 gap-1">
                {media.map((m) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={m.id} src={m.imageUrl ?? ""} alt="" className="aspect-square object-cover" />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#6F7480]">Chưa có ảnh được chia sẻ.</p>
            )
          ) : null}
          {tab === "places" ? (
            places.length ? (
              <ul className="space-y-2">
                {places.map((m) => (
                  <li key={m.id}>
                    <Link href={`/place/${m.place?.slug ?? ""}`} className="text-sm font-medium">
                      {m.place?.name ?? "Địa điểm"}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#6F7480]">Chưa có địa điểm được chia sẻ.</p>
            )
          ) : null}
          {tab === "posts" ? (
            posts.length ? (
              <ul className="space-y-2">
                {posts.map((m) => (
                  <li key={m.id}>
                    <Link href={`/post/${m.post?.id ?? ""}`} className="line-clamp-2 text-sm">
                      {m.post?.caption ?? "Bài viết"}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#6F7480]">Chưa có bài viết được chia sẻ.</p>
            )
          ) : null}
        </div>
        <div className="mt-6 flex flex-col text-sm">
          <button type="button" className="rounded-xl px-3 py-3 text-left hover:bg-brand/4" onClick={() => void toggleMute(conversationId)}>
            {muted ? "Bật thông báo" : "Tắt thông báo"}
          </button>
          <button
            type="button"
            className="rounded-xl px-3 py-3 text-left hover:bg-brand/4"
            onClick={() => void (blockedByMe ? unblockUser(peer.id) : blockUser(peer.id))}
          >
            {blockedByMe ? "Bỏ chặn" : "Chặn người dùng"}
          </button>
          <button type="button" className="rounded-xl px-3 py-3 text-left hover:bg-brand/4" onClick={() => void reportUser(peer.id)}>
            Báo cáo
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
