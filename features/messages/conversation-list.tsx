"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChatAvatar } from "./avatar";
import { lastMessagePreview } from "./format";
import { formatCompactTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { getOrCreateConversation, searchMessageablePeople } from "./actions";
import { usePresence } from "./presence";
import type { ConversationPreview, ProfileLite } from "./types";

export function ConversationList({
  conversations,
  activeId,
}: {
  conversations: ConversationPreview[];
  activeId?: string;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ProfileLite[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();
  const presence = usePresence();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((c) => {
      const name = `${c.other?.display_name ?? ""} ${c.other?.username ?? ""}`.toLowerCase();
      return name.includes(needle);
    });
  }, [conversations, q]);

  function onSearch(value: string) {
    setQ(value);
    if (value.trim().length < 2) {
      setHits([]);
      return;
    }
    start(async () => {
      try {
        setHits(await searchMessageablePeople(value));
      } catch {
        setHits([]);
      }
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-brand/8 bg-background">
      <div className="px-4 pb-3 pt-4">
        <h1 className="text-xl font-semibold text-brand">Tin nhắn</h1>
        <label className="sr-only" htmlFor="conv-search">
          Tìm cuộc trò chuyện
        </label>
        <input
          id="conv-search"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Tìm cuộc trò chuyện…"
          className="mt-3 h-11 w-full rounded-xl border border-[rgba(13,22,49,0.12)] bg-white px-3 text-sm text-brand outline-none placeholder:text-[#6F7480] focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-[rgba(13,22,49,0.08)]"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.length === 0 && !q ? (
          <div className="px-5 py-10 text-sm text-[#6F7480]">
            <p className="font-medium text-brand">Chưa có cuộc trò chuyện nào.</p>
            <p className="mt-2">Chia sẻ một trải nghiệm hoặc nhắn cho người bạn muốn khám phá cùng.</p>
            <Link href="/search?tab=people" className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-brand">
              Tìm người để kết nối
            </Link>
            <Link href="/explore" className="mt-1 block text-sm text-[#6F7480]">
              Khám phá trải nghiệm
            </Link>
          </div>
        ) : null}
        <ul>
          {filtered.map((conv) => {
            const active = conv.id === activeId;
            const snap = conv.other
              ? presence.getUserPresence(conv.other.id, conv.other.last_active_at ?? conv.other.last_seen_at, conv.other.show_activity_status)
              : { status: "unknown" as const, lastActiveAt: null };
            return (
              <li key={conv.id}>
                <Link
                  href={`/messages/${conv.id}`}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    active ? "bg-brand/6" : "hover:bg-brand/4",
                  )}
                >
                  <ChatAvatar
                    name={conv.other?.display_name ?? "?"}
                    src={conv.other?.avatar_path}
                    size={44}
                    presence={snap.status === "hidden" ? null : snap.status}
                    lastActiveAt={snap.lastActiveAt}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm", conv.unread ? "font-semibold text-brand" : "font-medium text-brand")}>
                        {conv.other?.display_name ?? "Cuộc trò chuyện"}
                      </span>
                      <span className="shrink-0 text-[11px] text-[#6F7480]">{formatCompactTime(conv.lastAt)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className={cn("min-w-0 flex-1 truncate text-[13px]", conv.unread ? "font-medium text-brand" : "text-[#6F7480]")}>
                        {lastMessagePreview(conv.last?.kind, conv.last?.body, Boolean(conv.last?.deleted_at))}
                      </span>
                      {conv.unread ? <span className="size-2 shrink-0 rounded-full bg-brand" aria-label="Chưa đọc" /> : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {hits.length > 0 ? (
          <div className="border-t border-brand/8 px-2 py-2">
            <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-[#6F7480]">Mọi người</p>
            {hits.map((person) => (
              <button
                key={person.id}
                type="button"
                disabled={pending}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-brand/4"
                onClick={() =>
                  start(async () => {
                    const id = await getOrCreateConversation(person.id);
                    router.push(`/messages/${id}`);
                  })
                }
              >
                <ChatAvatar name={person.display_name} src={person.avatar_path} size={36} />
                <span>
                  <span className="block text-sm font-medium">{person.display_name}</span>
                  <span className="text-xs text-[#6F7480]">@{person.username}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
