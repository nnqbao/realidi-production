"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ChatAvatar } from "./avatar";
import { respondToInvite, inviteToPlace } from "./actions";
import { inviteWhenLabel } from "./format";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ChatMessage, InviteStatus } from "./types";

export function SharedPostCard({ post }: { post: NonNullable<ChatMessage["post"]> }) {
  if (!post.id) {
    return <Unavailable />;
  }
  return (
    <Link
      href={`/post/${post.id}`}
      className="mt-1 block w-full max-w-[min(240px,100%)] overflow-hidden rounded-2xl border border-brand/10 bg-white text-left text-brand"
    >
      {post.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.thumbnail} alt="" className="h-28 w-full object-cover" />
      ) : null}
      <span className="block p-3">
        <span className="flex items-center gap-2">
          <ChatAvatar name={post.author.display_name} src={post.author.avatar_path} size={24} />
          <span className="truncate text-sm font-medium">{post.author.display_name}</span>
        </span>
        {post.caption ? <span className="mt-2 line-clamp-2 block text-sm text-[#6F7480]">{post.caption}</span> : null}
        {post.placeName ? <span className="mt-1 block text-xs text-[#6F7480]">{post.placeName}</span> : null}
        {post.verificationStatus === "verified" ? (
          <span className="mt-2 inline-block rounded-full bg-success/12 px-2 py-0.5 text-[11px] text-success">✓ Đã xác minh</span>
        ) : null}
        <span className="mt-2 block text-xs font-medium">Xem bài viết</span>
      </span>
    </Link>
  );
}

export function SharedPlaceCard({
  place,
  conversationId,
  canInvite,
}: {
  place: NonNullable<ChatMessage["place"]>;
  conversationId?: string;
  canInvite?: boolean;
}) {
  if (!place.slug) return <Unavailable />;
  return (
    <div className="mt-1 w-full max-w-[min(240px,100%)] overflow-hidden rounded-2xl border border-brand/10 bg-white text-brand">
      <Link href={`/place/${place.slug}`} className="block">
        {place.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={place.cover} alt="" className="h-32 w-full object-cover" />
        ) : (
          <span className="block h-16 bg-[#F1F2F4]" />
        )}
        <span className="block p-3">
          <span className="block font-medium">{place.name}</span>
          <span className="mt-0.5 block text-xs text-[#6F7480]">
            {[place.categoryName, place.district].filter(Boolean).join(" · ")}
          </span>
          {place.moodName ? <span className="mt-2 block text-xs">❤️ {place.moodName}</span> : null}
          {place.spendLabel ? <span className="mt-1 block text-xs text-[#6F7480]">{place.spendLabel}</span> : null}
          {place.verified ? (
            <span className="mt-2 block text-[11px] text-success">✓ Có trải nghiệm đã xác minh</span>
          ) : null}
          <span className="mt-2 block text-xs font-medium">Xem địa điểm</span>
        </span>
      </Link>
      {canInvite && conversationId ? <InviteFromCard placeId={place.id} conversationId={conversationId} /> : null}
    </div>
  );
}

function InviteFromCard({ placeId, conversationId }: { placeId: string; conversationId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  return (
    <>
      <button
        type="button"
        className="w-full border-t border-brand/8 py-2.5 text-sm font-medium text-brand"
        onClick={() => setOpen(true)}
      >
        Rủ đi cùng
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-5 pt-12" fullScreenMobile={false}>
          <DialogTitle>Rủ đi cùng</DialogTitle>
          <label className="mt-4 block text-sm">
            Gợi ý ngày (không bắt buộc)
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-[rgba(13,22,49,0.12)] bg-white px-3"
            />
          </label>
          <label className="mt-3 block text-sm">
            Giờ (không bắt buộc)
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-[rgba(13,22,49,0.12)] bg-white px-3"
            />
          </label>
          <label className="mt-3 block text-sm">
            Lời nhắn (không bắt buộc)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={280}
              placeholder="Tối thứ 7 đi không?"
              className="mt-1 min-h-11 w-full rounded-xl border border-[rgba(13,22,49,0.12)] bg-white px-3"
            />
          </label>
          <button
            type="button"
            disabled={pending || sent}
            className="mt-4 min-h-11 w-full rounded-xl bg-brand text-sm font-medium text-white disabled:opacity-40"
            onClick={() =>
              start(async () => {
                await inviteToPlace({
                  placeId,
                  conversationId,
                  note: note || null,
                  suggestedDate: date || null,
                  suggestedTime: time || null,
                });
                setSent(true);
                setOpen(false);
              })
            }
          >
            {sent ? "Đã gửi lời mời" : "Gửi lời mời"}
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SharedProfileCard({ profile }: { profile: NonNullable<ChatMessage["profile"]> }) {
  if (!profile.username) return <Unavailable />;
  return (
    <Link href={`/user/${profile.username}`} className="mt-1 flex w-full max-w-[min(240px,100%)] gap-3 rounded-2xl border border-brand/10 bg-white p-3 text-brand">
      <ChatAvatar name={profile.display_name} src={profile.avatar_path} size={44} />
      <span className="min-w-0">
        <span className="block truncate font-medium">{profile.display_name}</span>
        <span className="block truncate text-xs text-[#6F7480]">@{profile.username}</span>
        {profile.bio ? <span className="mt-1 line-clamp-2 block text-xs text-[#6F7480]">{profile.bio}</span> : null}
        <span className="mt-2 block text-xs font-medium">Xem hồ sơ</span>
      </span>
    </Link>
  );
}

export function InviteCard({
  message,
  mine,
}: {
  message: ChatMessage;
  mine: boolean;
}) {
  const [pending, start] = useTransition();
  const invite = message.invite;
  const place = message.place;
  if (!place && !invite) return <Unavailable />;
  const status = invite?.status ?? "pending";
  const when = inviteWhenLabel(invite?.suggestedDate, invite?.suggestedTime);
  function respond(next: InviteStatus) {
    if (!invite?.invitationId) return;
    start(() => respondToInvite({ invitationId: invite.invitationId!, messageId: message.id, status: next }));
  }
  return (
    <div className="mt-1 w-[260px] rounded-2xl border border-brand/10 bg-white p-3 text-brand">
      <p className="text-[11px] font-semibold tracking-wide text-[#6F7480]">RỦ ĐI CÙNG</p>
      {place ? (
        <Link href={`/place/${place.slug}`} className="mt-2 block">
          <span className="block font-medium">{place.name}</span>
          {place.district ? <span className="text-xs text-[#6F7480]">{place.district}</span> : null}
        </Link>
      ) : (
        <p className="mt-2 font-medium">{String(message.payload.placeName ?? "Địa điểm")}</p>
      )}
      {when ? <p className="mt-2 text-sm">{when}</p> : null}
      {invite?.note ? <p className="mt-2 text-sm text-[#6F7480]">“{invite.note}”</p> : null}
      {!mine && status === "pending" ? (
        <div className="mt-3 grid grid-cols-1 gap-1.5">
          <button type="button" disabled={pending} onClick={() => respond("accepted")} className="min-h-10 rounded-xl bg-brand text-sm font-medium text-white">
            Đi luôn
          </button>
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" disabled={pending} onClick={() => respond("maybe")} className="min-h-10 rounded-xl border border-brand/12 text-sm">
              Để xem
            </button>
            <button type="button" disabled={pending} onClick={() => respond("declined")} className="min-h-10 rounded-xl border border-brand/12 text-sm">
              Không đi được
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-[#6F7480]">
          {status === "accepted" ? "Đã nhận lời đi cùng." : status === "maybe" ? "Để xem lại." : status === "declined" ? "Không đi được." : mine ? "Đang chờ trả lời." : null}
        </p>
      )}
    </div>
  );
}

function Unavailable() {
  return <p className="mt-1 text-sm opacity-80">Nội dung này không còn khả dụng.</p>;
}
