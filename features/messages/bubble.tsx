"use client";

import { useState } from "react";
import { ChatAvatar } from "./avatar";
import { InviteCard, SharedPlaceCard, SharedPostCard, SharedProfileCard } from "./cards";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { lastMessagePreview, messageTimeLabel } from "./format";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "./types";

const REACTIONS = ["❤️", "👍", "😂", "😮", "😢"] as const;

export function MessageBubble({
  message,
  mine,
  grouped,
  showAvatar,
  isLatestMine,
  peerRead,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onCopy,
  onReport,
  onRetry,
  conversationId,
}: {
  message: ChatMessage;
  mine: boolean;
  grouped: boolean;
  showAvatar: boolean;
  isLatestMine: boolean;
  peerRead: boolean;
  onReply: () => void;
  onReact: (reaction: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onReport: () => void;
  onRetry?: () => void;
  conversationId: string;
}) {
  const [menu, setMenu] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const failed = message.status === "failed";
  const sending = message.status === "sending";
  const objectKind = message.kind === "post" || message.kind === "place" || message.kind === "profile" || message.kind === "invite" || message.kind === "image";

  if (message.deleted_at) {
    return (
      <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
        <p className="px-1 text-xs italic text-[#6F7480]">Tin nhắn đã được thu hồi.</p>
      </div>
    );
  }

  return (
    <div className={cn("flex items-end gap-2", mine ? "flex-row-reverse" : "flex-row", grouped ? "mt-0.5" : "mt-2")}>
      <div className="w-8 shrink-0">
        {!mine && showAvatar ? <ChatAvatar name={message.sender?.display_name ?? "?"} src={message.sender?.avatar_path} size={32} /> : null}
      </div>
      <div className={cn("max-w-[min(82%,100%)] min-w-0 md:max-w-[65%]", mine ? "items-end" : "items-start")}>
        {message.reply ? (
          <button type="button" className="mb-1 max-w-full truncate rounded-lg bg-black/5 px-2 py-1 text-[11px] text-[#6F7480]" onClick={() => document.getElementById(`msg-${message.reply?.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>
            Trả lời {message.reply.senderName}: {message.reply.body || lastMessagePreview(message.reply.kind)}
          </button>
        ) : null}
        {objectKind ? (
          <div
            id={`msg-${message.id}`}
            className="relative w-full max-w-full overflow-hidden text-sm"
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu(true);
            }}
          >
            {message.kind === "image" && (message.imageUrl || message.payload.localImageUrl) ? (
              <button type="button" className="block max-w-full" onClick={() => setLightbox(true)} aria-label="Xem ảnh">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={String(message.imageUrl ?? message.payload.localImageUrl)}
                  alt=""
                  className="max-h-64 w-auto max-w-full rounded-xl object-contain"
                />
              </button>
            ) : null}
            {message.body && message.kind !== "invite" ? (
              <p className={cn("mt-1 max-w-full whitespace-pre-wrap break-words rounded-[18px] px-3 py-2", mine ? "bg-brand text-white" : "bg-[#F1F2F4] text-brand")}>
                {message.body}
              </p>
            ) : null}
            {message.kind === "post" && message.post ? <div className={mine ? "text-brand" : undefined}><SharedPostCard post={message.post} /></div> : null}
            {message.kind === "place" && message.place ? (
              <div className={mine ? "text-brand" : undefined}>
                <SharedPlaceCard place={message.place} conversationId={conversationId} canInvite={mine} />
              </div>
            ) : null}
            {message.kind === "profile" && message.profile ? <div className={mine ? "text-brand" : undefined}><SharedProfileCard profile={message.profile} /></div> : null}
            {message.kind === "invite" ? <InviteCard message={message} mine={mine} /> : null}
            {message.edited_at ? <span className={cn("mt-1 block text-[10px]", mine ? "text-[#6F7480]" : "text-[#6F7480]")}>đã chỉnh sửa</span> : null}
          </div>
        ) : (
        <div
          id={`msg-${message.id}`}
          role="button"
          tabIndex={0}
          onClick={() => setShowTime((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setShowTime((v) => !v);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu(true);
          }}
          className={cn(
            "relative w-fit max-w-full text-sm",
            "rounded-[18px] px-3 py-2",
            mine ? "bg-brand text-white" : "bg-[#F1F2F4] text-brand",
            sending && "opacity-70",
            failed && "ring-1 ring-destructive",
          )}
        >
          {message.body ? (
            <p className="whitespace-pre-wrap break-words">
              {message.body}
            </p>
          ) : null}
          {message.edited_at ? <span className={cn("mt-1 block text-[10px]", mine ? "text-white/70" : "text-[#6F7480]")}>đã chỉnh sửa</span> : null}
        </div>
        )}
        {message.reactions.length > 0 ? (
          <div className={cn("mt-0.5 flex gap-1", mine ? "justify-end" : "justify-start")}>
            {message.reactions.map((row) => (
              <button
                key={row.reaction}
                type="button"
                className={cn("rounded-full bg-white px-1.5 py-0.5 text-xs shadow-sm", row.mine && "ring-1 ring-brand/20")}
                onClick={() => onReact(row.reaction)}
                aria-label={`Reaction ${row.reaction}`}
              >
                {row.reaction}
                {row.count > 1 ? ` ${row.count}` : ""}
              </button>
            ))}
          </div>
        ) : null}
        {showTime || menu ? (
          <div className={cn("mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#6F7480]", mine ? "justify-end" : "justify-start")}>
            <span>{messageTimeLabel(message.created_at)}</span>
            <button type="button" onClick={onReply}>Trả lời</button>
            {message.body ? <button type="button" onClick={onCopy}>Sao chép</button> : null}
            {mine && message.kind === "text" ? <button type="button" onClick={onEdit}>Chỉnh sửa</button> : null}
            {mine ? <button type="button" onClick={onDelete}>Xóa</button> : <button type="button" onClick={onReport}>Báo cáo</button>}
            <span className="flex gap-0.5">
              {REACTIONS.map((r) => (
                <button key={r} type="button" className="size-7" aria-label={`Thả ${r}`} onClick={() => onReact(r)}>
                  {r}
                </button>
              ))}
            </span>
          </div>
        ) : null}
        {isLatestMine ? (
          failed ? (
            <button type="button" className="mt-1 block w-full text-right text-[11px] text-destructive" onClick={onRetry}>
              Gửi lại
            </button>
          ) : (
            <p className="mt-1 text-right text-[11px] text-[#6F7480]">{sending ? "Đang gửi" : peerRead ? "Đã xem" : "Đã gửi"}</p>
          )
        ) : null}
      </div>
      <Dialog open={lightbox} onOpenChange={setLightbox}>
        <DialogContent className="bg-black p-2 pt-12" fullScreenMobile>
          <DialogTitle className="sr-only">Ảnh</DialogTitle>
          {message.imageUrl || message.payload.localImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={String(message.imageUrl ?? message.payload.localImageUrl)} alt="" className="max-h-[80vh] w-full object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
