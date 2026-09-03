"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Share } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { usePresence } from "@/features/presence/provider";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getShareRecipients, shareEntityToUser } from "@/features/messages/actions";
import { recordShare } from "@/features/social/actions";

type Recipient = { id: string; username: string; display_name: string; avatar_path?: string | null; source: string };

export function ShareSheet({
  path,
  kind,
  payload,
  postId,
  placeId,
  label = "Chia sẻ",
}: {
  path: string;
  kind?: "post" | "place" | "profile";
  payload?: Record<string, string | null | undefined>;
  postId?: string;
  placeId?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [people, setPeople] = useState<Recipient[]>([]);
  const [pending, start] = useTransition();
  const [sent, setSent] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const presence = usePresence();
  const resolvedKind = kind ?? (postId ? "post" : placeId ? "place" : "post");
  const resolvedPayload = payload ?? { postId: postId ?? null, placeId: placeId ?? null };

  function openSheet() {
    setOpen(true);
    start(async () => {
      try {
        setPeople(await getShareRecipients());
      } catch {
        setPeople([]);
      }
    });
  }

  async function copy() {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopied(true);
    void recordShare({ postId, placeId });
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className="inline-flex items-center gap-1.5 text-sm text-brand/68 hover:text-brand"
        aria-label={label}
      >
        <Share className="size-5" />
        <span>{label}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-5 pt-12" fullScreenMobile={false}>
          <DialogTitle>Chia sẻ</DialogTitle>
          <div className="mt-4 space-y-3">
            <button type="button" onClick={copy} className="w-full rounded-xl border border-border px-3 py-2 text-left text-sm">
              {copied ? "Đã sao chép liên kết" : "Sao chép liên kết"}
            </button>
            <input
              value={q}
              onChange={(e) => {
                const value = e.target.value;
                setQ(value);
                if (value.trim().length < 2) return;
                start(async () => {
                  try {
                    setPeople(await getShareRecipients(value));
                  } catch {
                    setPeople([]);
                  }
                });
              }}
              placeholder="Tìm người…"
              className="h-11 w-full rounded-xl border border-[rgba(13,22,49,0.12)] bg-white px-3 text-sm outline-none focus-visible:border-brand"
            />
            <p className="text-xs font-medium text-muted-foreground">Gửi qua Realidi</p>
            {people.length === 0 ? (
              <p className="text-sm text-muted-foreground">Theo dõi ai đó hoặc bắt đầu trò chuyện để gửi nhanh.</p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {people.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const conversationId = await shareEntityToUser({ userId: person.id, kind: resolvedKind, payload: resolvedPayload });
                          setSent(person.display_name);
                          setSentId(conversationId);
                        })
                      }
                      className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left hover:bg-muted"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <UserAvatar
                          name={person.display_name}
                          src={person.avatar_path}
                          size={36}
                          presence={presence.getUserPresence(person.id).status === "online" ? "online" : null}
                        />
                        <span>
                          <span className="block text-sm font-medium">{person.display_name}</span>
                          <span className="text-xs text-muted-foreground">@{person.username}</span>
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {person.source === "recent" ? "Gần đây" : "Đang theo dõi"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {sent ? (
              <p className="text-sm text-success">
                Đã gửi cho {sent}.{" "}
                {sentId ? (
                  <Link href={`/messages/${sentId}`} className="font-medium text-brand underline">
                    Mở tin nhắn
                  </Link>
                ) : null}
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
