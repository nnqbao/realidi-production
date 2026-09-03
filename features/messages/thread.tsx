"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, MoreHorizontal } from "lucide-react";
import { ChatAvatar } from "./avatar";
import { MessageBubble } from "./bubble";
import { MessageComposer } from "./composer";
import { ConversationInfo } from "./info-drawer";
import { usePresence } from "./presence";
import { presenceCopy } from "@/features/presence/format";
import { useRealtimeChannel } from "@/features/realtime/use-realtime-channel";
import { useDidReconnect } from "@/features/realtime/connection";
import { conversationChannelName } from "@/features/realtime/reconnect";
import { buildTimeline, lastMessagePreview } from "./format";
import {
  deleteMessage,
  editMessage,
  listMessages,
  markConversationRead,
  reportMessage,
  sendMessage,
  toggleReaction,
  getHydratedMessage,
} from "./actions";
import type { ChatKind, ChatMessage, ProfileLite, ThreadPage } from "./types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function ChatThread({
  conversationId,
  currentUserId,
  peer,
  initial,
}: {
  conversationId: string;
  currentUserId: string;
  peer: ProfileLite;
  initial: ThreadPage;
}) {
  const [messages, setMessages] = useState(initial.messages);
  const [nextCursor, setNextCursor] = useState(initial.nextCursor);
  const peerReadAt = initial.peerLastReadAt;
  const [typing, setTyping] = useState(false);
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [newBelow, setNewBelow] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const presence = usePresence();
  const snap = presence.getUserPresence(peer.id, peer.last_active_at ?? peer.last_seen_at ?? null, peer.show_activity_status);
  const statusLabel = presenceCopy(snap.status, snap.lastActiveAt);
  const peerPresence = snap.status === "hidden" ? null : snap.status;

  useEffect(() => {
    void markConversationRead(conversationId);
  }, [conversationId]);

  const scrollToEnd = useCallback((smooth = false) => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    scrollToEnd(false);
  }, [conversationId, scrollToEnd]);

  const recover = useCallback(() => {
    void listMessages(conversationId).then((page) => {
      setMessages((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m]));
        for (const row of page.messages) {
          if (row.id) byId.set(row.id, { ...row, status: "sent" as const });
        }
        return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
    });
  }, [conversationId]);

  const { channelRef, showReconnect, connected } = useRealtimeChannel(
    conversationChannelName(conversationId),
    (channel) =>
      channel
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            const row = payload.new as ChatMessage & { payload: Record<string, unknown> };
            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id || (row.client_id && m.client_id === row.client_id))) {
                return prev.map((m) => (m.client_id && m.client_id === row.client_id ? { ...m, id: row.id, status: "sent" } : m));
              }
              if (!nearBottom.current && row.sender_id !== currentUserId) {
                setNewBelow(true);
              }
              return [
                ...prev.filter((m) => m.id !== row.id),
                {
                  ...row,
                  kind: row.kind,
                  payload: row.payload ?? {},
                  deleted_at: row.deleted_at ?? null,
                  edited_at: row.edited_at ?? null,
                  client_id: row.client_id ?? null,
                  reply_to_message_id: row.reply_to_message_id ?? null,
                  reply: null,
                  sender: row.sender_id === currentUserId ? null : peer,
                  reactions: [],
                  imageUrl: null,
                  post: null,
                  place: null,
                  profile: null,
                  invite: null,
                  status: "sent",
                },
              ];
            });
            if (row.kind !== "text" || row.reply_to_message_id) {
              void getHydratedMessage(row.id).then((full) => {
                if (!full) return;
                setMessages((prev) => {
                  if (prev.some((m) => m.id === full.id)) {
                    return prev.map((m) => (m.id === full.id || (full.client_id && m.client_id === full.client_id) ? { ...full, status: "sent" } : m));
                  }
                  return [...prev, { ...full, status: "sent" }];
                });
              });
            }
            if (row.sender_id !== currentUserId) void markConversationRead(conversationId);
            if (nearBottom.current) requestAnimationFrame(() => scrollToEnd(true));
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            const row = payload.new as ChatMessage;
            setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row, payload: (row.payload as Record<string, unknown>) ?? m.payload } : m)));
          },
        )
        .on("broadcast", { event: "typing" }, (event) => {
          const from = (event.payload as { userId?: string })?.userId;
          if (!from || from === currentUserId) return;
          setTyping(true);
          window.setTimeout(() => setTyping(false), 2500);
        }),
  );

  useDidReconnect(connected, recover);

  const lastTyped = useRef(0);
  function onTyping() {
    const now = Date.now();
    if (now - lastTyped.current < 900) return;
    lastTyped.current = now;
    void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: currentUserId } });
  }

  async function loadOlder() {
    if (!nextCursor || loadingOlder) return;
    const node = scroller.current;
    const prevHeight = node?.scrollHeight ?? 0;
    setLoadingOlder(true);
    const page = await listMessages(conversationId, nextCursor);
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      return [...page.messages.filter((m) => !seen.has(m.id)), ...prev];
    });
    setNextCursor(page.nextCursor);
    setLoadingOlder(false);
    requestAnimationFrame(() => {
      if (node) node.scrollTop = node.scrollHeight - prevHeight;
    });
  }

  async function onSend(input: {
    body?: string | null;
    kind: ChatKind;
    payload?: Record<string, string | null>;
    clientId: string;
    replyToMessageId?: string | null;
    localImageUrl?: string | null;
  }) {
    const optimistic: ChatMessage = {
      id: `local-${input.clientId}`,
      conversation_id: conversationId,
      sender_id: currentUserId,
      body: input.body ?? null,
      kind: input.kind,
      payload: { ...(input.payload ?? {}), localImageUrl: input.localImageUrl ?? null },
      created_at: new Date().toISOString(),
      deleted_at: null,
      edited_at: null,
      client_id: input.clientId,
      reply_to_message_id: input.replyToMessageId ?? null,
      reply: reply
        ? { id: reply.id, body: reply.body, kind: reply.kind, senderName: reply.sender?.display_name ?? "Bạn" }
        : null,
      sender: null,
      reactions: [],
      imageUrl: input.localImageUrl ?? null,
      post: null,
      place: null,
      profile: null,
      invite: input.kind === "invite" ? { invitationId: null, status: "pending", suggestedDate: null, suggestedTime: null, note: input.body ?? null } : null,
      status: "sending",
    };
    setMessages((prev) => [...prev, optimistic]);
    requestAnimationFrame(() => scrollToEnd(true));
    try {
      const saved = await sendMessage({
        conversationId,
        body: input.body,
        kind: input.kind,
        payload: input.payload ?? {},
        clientId: input.clientId,
        replyToMessageId: input.replyToMessageId,
      });
      setMessages((prev) => prev.map((m) => (m.client_id === input.clientId ? { ...saved, status: "sent" } : m)));
    } catch {
      setMessages((prev) => prev.map((m) => (m.client_id === input.clientId ? { ...m, status: "failed" } : m)));
    }
  }

  const timeline = useMemo(() => buildTimeline(messages), [messages]);
  const latestMine = [...messages].reverse().find((m) => m.sender_id === currentUserId && !m.deleted_at);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-brand/8 px-3 md:h-[72px] md:px-4">
        <Link href="/messages" className="inline-flex size-11 items-center justify-center text-brand md:hidden" aria-label="Quay lại">
          ←
        </Link>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setInfoOpen(true)}>
          <span className="relative">
            <ChatAvatar
              name={peer.display_name}
              src={peer.avatar_path}
              size={40}
              presence={peerPresence}
              lastActiveAt={snap.lastActiveAt}
            />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-brand">{peer.display_name}</span>
            <span className="block truncate text-xs text-[#6F7480]">
              @{peer.username}
              {statusLabel ? ` · ${statusLabel}` : ""}
            </span>
          </span>
        </button>
        <button type="button" className="inline-flex size-11 items-center justify-center rounded-full hover:bg-brand/4" aria-label="Thêm" onClick={() => setMenuOpen(true)}>
          <MoreHorizontal className="size-5" />
        </button>
      </header>
      {showReconnect ? (
        <p className="bg-brand/4 px-4 py-1 text-center text-xs text-[#6F7480]" role="status">
          Đang kết nối lại…
        </p>
      ) : null}
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          if (nearBottom.current) setNewBelow(false);
          if (el.scrollTop < 48) void loadOlder();
        }}
      >
        <div className="flex min-h-full flex-col justify-end">
          {loadingOlder ? <p className="py-2 text-center text-xs text-[#6F7480]">Đang tải…</p> : null}
          {messages.length === 0 ? (
            <EmptyThread
              name={peer.display_name}
              onHello={() => void onSend({ body: "Chào bạn 👋", kind: "text", clientId: crypto.randomUUID() })}
              onWeekend={() => void onSend({ body: "Cuối tuần đi đâu không?", kind: "text", clientId: crypto.randomUUID() })}
            />
          ) : (
            timeline.map((item) =>
              item.type === "sep" ? (
                <p key={item.key} className="py-3 text-center text-[11px] text-[#6F7480]">
                  {item.label}
                </p>
              ) : (
                <MessageBubble
                  key={item.key}
                  message={item.message}
                  mine={item.message.sender_id === currentUserId}
                  grouped={item.grouped}
                  showAvatar={item.showAvatar}
                  isLatestMine={latestMine?.id === item.message.id}
                  peerRead={Boolean(peerReadAt && latestMine && peerReadAt >= latestMine.created_at)}
                  conversationId={conversationId}
                  onReply={() => setReply(item.message)}
                  onReact={(reaction) => {
                    void toggleReaction(item.message.id, reaction);
                    setMessages((prev) =>
                      prev.map((m) => {
                        if (m.id !== item.message.id) return m;
                        const mine = m.reactions.find((r) => r.mine);
                        let next = m.reactions.map((r) => (r.mine ? { ...r, mine: false, count: r.count - 1 } : r)).filter((r) => r.count > 0);
                        if (!mine || mine.reaction !== reaction) {
                          const existing = next.find((r) => r.reaction === reaction);
                          next = existing
                            ? next.map((r) => (r.reaction === reaction ? { ...r, count: r.count + 1, mine: true } : r))
                            : [...next, { reaction, count: 1, mine: true }];
                        }
                        return { ...m, reactions: next };
                      }),
                    );
                  }}
                  onCopy={() => item.message.body && navigator.clipboard.writeText(item.message.body)}
                  onEdit={() => {
                    const next = window.prompt("Chỉnh sửa tin nhắn", item.message.body ?? "");
                    if (next) void editMessage(item.message.id, next);
                  }}
                  onDelete={() => void deleteMessage(item.message.id)}
                  onReport={() => void reportMessage(item.message.id)}
                  onRetry={() => {
                    const failed = item.message;
                    setMessages((prev) => prev.filter((m) => m.id !== failed.id));
                    void onSend({
                      body: failed.body,
                      kind: failed.kind,
                      payload: Object.fromEntries(
                        Object.entries(failed.payload).filter(([key, value]) => key !== "localImageUrl" && typeof value === "string"),
                      ) as Record<string, string | null>,
                      clientId: crypto.randomUUID(),
                      replyToMessageId: failed.reply_to_message_id,
                      localImageUrl: failed.imageUrl,
                    });
                  }}
                />
              ),
            )
          )}
          {typing ? <p className="mt-2 pl-10 text-xs text-[#6F7480]">{peer.display_name.split(" ")[0]} đang nhập…</p> : null}
        </div>
      </div>
      {newBelow ? (
        <button
          type="button"
          className="mx-auto mb-1 rounded-full bg-brand px-3 py-1.5 text-xs text-white"
          onClick={() => {
            setNewBelow(false);
            scrollToEnd(true);
          }}
        >
          <ArrowDown className="mr-1 inline size-3" />
          Tin nhắn mới
        </button>
      ) : null}
      {initial.blocked ? (
        <p className="border-t border-brand/8 px-4 py-4 text-center text-sm text-[#6F7480]">
          {initial.blockedByMe ? "Bạn đã chặn người này. Bỏ chặn để nhắn tin lại." : "Cuộc trò chuyện này hiện không khả dụng."}
        </p>
      ) : (
        <MessageComposer
          conversationId={conversationId}
          userId={currentUserId}
          reply={reply ? { id: reply.id, preview: reply.body || lastMessagePreview(reply.kind) } : null}
          onCancelReply={() => setReply(null)}
          onSend={onSend}
          onTyping={onTyping}
        />
      )}
      <ConversationInfo open={infoOpen} onClose={() => setInfoOpen(false)} conversationId={conversationId} peer={peer} muted={initial.muted} blockedByMe={initial.blockedByMe} />
      <HeaderMenu open={menuOpen} onClose={() => setMenuOpen(false)} peer={peer} onOpenInfo={() => { setMenuOpen(false); setInfoOpen(true); }} conversationId={conversationId} blockedByMe={initial.blockedByMe} />
    </div>
  );
}

function EmptyThread({
  name,
  onHello,
  onWeekend,
}: {
  name: string;
  onHello: () => void;
  onWeekend: () => void;
}) {
  return (
    <div className="px-4 pb-6 pt-10 text-center">
      <p className="text-sm text-brand">Bắt đầu trò chuyện với {name.split(" ")[0]}.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onHello} className="min-h-11 rounded-full border border-brand/12 px-3 text-sm">
          Chào bạn 👋
        </button>
        <button type="button" onClick={onWeekend} className="min-h-11 rounded-full border border-brand/12 px-3 text-sm">
          Cuối tuần đi đâu không?
        </button>
        <p className="w-full text-xs text-[#6F7480]">Gửi một địa điểm từ nút + khi bạn muốn rủ đi.</p>
      </div>
    </div>
  );
}

function HeaderMenu({
  open,
  onClose,
  peer,
  onOpenInfo,
  conversationId,
  blockedByMe,
}: {
  open: boolean;
  onClose: () => void;
  peer: ProfileLite;
  onOpenInfo: () => void;
  conversationId: string;
  blockedByMe: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-5 pt-12" fullScreenMobile={false}>
        <DialogTitle>Tùy chọn</DialogTitle>
        <div className="mt-4 flex flex-col gap-1 text-sm">
          <Link href={`/user/${peer.username}`} className="rounded-xl px-3 py-3 hover:bg-brand/4">Xem hồ sơ</Link>
          <button type="button" className="rounded-xl px-3 py-3 text-left hover:bg-brand/4" onClick={onOpenInfo}>Chi tiết cuộc trò chuyện</button>
          <MuteBlockActions conversationId={conversationId} peerId={peer.id} blockedByMe={blockedByMe} onClose={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MuteBlockActions({
  conversationId,
  peerId,
  blockedByMe,
  onClose,
}: {
  conversationId: string;
  peerId: string;
  blockedByMe: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <form action={async () => { const { toggleMute } = await import("./actions"); await toggleMute(conversationId); onClose(); }}>
        <button type="submit" className="w-full rounded-xl px-3 py-3 text-left hover:bg-brand/4">Tắt thông báo</button>
      </form>
      <form action={async () => { const { blockUser, unblockUser } = await import("./actions"); if (blockedByMe) await unblockUser(peerId); else await blockUser(peerId); onClose(); }}>
        <button type="submit" className="w-full rounded-xl px-3 py-3 text-left hover:bg-brand/4">{blockedByMe ? "Bỏ chặn" : "Chặn người dùng"}</button>
      </form>
      <form action={async () => { const { reportUser } = await import("./actions"); await reportUser(peerId); onClose(); }}>
        <button type="submit" className="w-full rounded-xl px-3 py-3 text-left hover:bg-brand/4">Báo cáo</button>
      </form>
    </>
  );
}
