"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus, MapPin, Newspaper, Plus, Send, Smile, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { validateMediaFile } from "@/lib/media";
import { getAttachablePlaces, getAttachablePosts } from "./actions";
import { cn } from "@/lib/utils";
import type { ChatKind } from "./types";

const QUICK_EMOJI = ["😊", "❤️", "👍", "😂", "👋"];

export function MessageComposer({
  conversationId,
  userId,
  disabled,
  reply,
  onCancelReply,
  onSend,
  onTyping,
}: {
  conversationId: string;
  userId: string;
  disabled?: boolean;
  reply?: { id: string; preview: string } | null;
  onCancelReply?: () => void;
  onSend: (input: {
    body?: string | null;
    kind: ChatKind;
    payload?: Record<string, string | null>;
    clientId: string;
    replyToMessageId?: string | null;
    localImageUrl?: string | null;
  }) => Promise<void>;
  onTyping: () => void;
}) {
  const [body, setBody] = useState("");
  const [plusOpen, setPlusOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [picker, setPicker] = useState<"place" | "post" | null>(null);
  const [places, setPlaces] = useState<Array<{ id: string; slug: string; name: string; district: string | null; categoryName: string | null }>>([]);
  const [posts, setPosts] = useState<Array<{ id: string; caption: string | null; placeName: string | null }>>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function submit(kind: ChatKind = "text", payload?: Record<string, string | null>, image?: File | null) {
    const text = body.trim();
    if (kind === "text" && !text && !image) return;
    const clientId = crypto.randomUUID();
    let imagePayload: Record<string, string | null> | undefined = payload;
    const localImageUrl = preview;
    start(async () => {
      try {
        if (image) {
          const check = validateMediaFile(image);
          if (!check.ok) throw new Error(check.error);
          const supabase = createClient();
          const ext = image.name.split(".").pop() ?? "jpg";
          const path = `${userId}/${conversationId}/${clientId}.${ext}`;
          const { error } = await supabase.storage.from("message-media").upload(path, image, { contentType: image.type });
          if (error) throw error;
          imagePayload = { storagePath: path };
        }
        await onSend({
          body: text || null,
          kind: image ? "image" : kind,
          payload: imagePayload,
          clientId,
          replyToMessageId: reply?.id ?? null,
          localImageUrl,
        });
        setBody("");
        setFile(null);
        setPreview(null);
        onCancelReply?.();
      } catch {
        /* parent records failed */
      }
    });
  }

  return (
    <div className="border-t border-brand/8 bg-background px-3 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {reply ? (
        <div className="mb-2 flex items-center justify-between rounded-xl bg-brand/4 px-3 py-2 text-xs text-[#6F7480]">
          <span className="truncate">Trả lời: {reply.preview}</span>
          <button type="button" className="size-8" aria-label="Hủy trả lời" onClick={onCancelReply}>
            <X className="size-4" />
          </button>
        </div>
      ) : null}
      {preview ? (
        <div className="mb-2 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="h-16 w-16 rounded-xl object-cover" />
          <button type="button" className="text-xs text-[#6F7480]" onClick={() => {
            setFile(null);
            setPreview((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return null;
            });
          }}>
            Xóa ảnh
          </button>
        </div>
      ) : null}
      <div className="flex items-end gap-1.5">
        <div className="relative">
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full text-brand hover:bg-brand/4"
            aria-label="Đính kèm"
            disabled={disabled}
            onClick={() => setPlusOpen((v) => !v)}
          >
            <Plus className="size-5" />
          </button>
          {plusOpen ? (
            <div className="absolute bottom-12 left-0 z-20 w-44 overflow-hidden rounded-2xl border border-brand/10 bg-white py-1 shadow-[var(--shadow-card)]">
              <AttachItem
                icon={ImagePlus}
                label="Ảnh"
                onClick={() => {
                  setPlusOpen(false);
                  fileRef.current?.click();
                }}
              />
              <AttachItem
                icon={MapPin}
                label="Địa điểm"
                onClick={() => {
                  setPlusOpen(false);
                  setPicker("place");
                  start(async () => setPlaces(await getAttachablePlaces()));
                }}
              />
              <AttachItem
                icon={Newspaper}
                label="Bài viết Realidi"
                onClick={() => {
                  setPlusOpen(false);
                  setPicker("post");
                  start(async () => setPosts(await getAttachablePosts()));
                }}
              />
            </div>
          ) : null}
        </div>
        <textarea
          ref={areaRef}
          value={body}
          disabled={disabled}
          rows={1}
          placeholder="Nhập tin nhắn…"
          aria-label="Nhập tin nhắn"
          onChange={(e) => {
            setBody(e.target.value);
            onTyping();
            e.currentTarget.style.height = "auto";
            e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 120)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit(file ? "image" : "text", undefined, file);
            }
          }}
          className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-[rgba(13,22,49,0.12)] bg-white px-3 py-2.5 text-sm text-brand outline-none placeholder:text-[#6F7480] focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-[rgba(13,22,49,0.08)]"
        />
        <div className="relative">
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full text-brand hover:bg-brand/4"
            aria-label="Emoji"
            onClick={() => setEmojiOpen((v) => !v)}
          >
            <Smile className="size-5" />
          </button>
          {emojiOpen ? (
            <div className="absolute bottom-12 right-0 z-20 flex gap-1 rounded-2xl border border-brand/10 bg-white p-2 shadow-[var(--shadow-card)]">
              {QUICK_EMOJI.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="size-9 text-lg"
                  onClick={() => {
                    setBody((v) => v + emoji);
                    setEmojiOpen(false);
                    areaRef.current?.focus();
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          disabled={disabled || pending || (!body.trim() && !file)}
          aria-label="Gửi"
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-full bg-brand text-white disabled:opacity-40",
          )}
          onClick={() => void submit(file ? "image" : "text", undefined, file)}
        >
          <Send className="size-4" />
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(e) => {
          const next = e.target.files?.[0] ?? null;
          setFile(next);
          setPreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return next ? URL.createObjectURL(next) : null;
          });
        }}
      />
      <Dialog open={picker !== null} onOpenChange={() => setPicker(null)}>
        <DialogContent className="p-5 pt-12" fullScreenMobile={false}>
          <DialogTitle>{picker === "place" ? "Gửi địa điểm" : "Gửi bài viết"}</DialogTitle>
          <ul className="mt-4 max-h-72 space-y-1 overflow-y-auto">
            {picker === "place"
              ? places.map((place) => (
                  <li key={place.id}>
                    <button
                      type="button"
                      className="w-full rounded-xl px-3 py-2 text-left hover:bg-brand/4"
                      onClick={() => {
                        void submit("place", { placeId: place.id, placeSlug: place.slug, placeName: place.name, placeDistrict: place.district });
                        setPicker(null);
                      }}
                    >
                      <span className="block text-sm font-medium">{place.name}</span>
                      <span className="text-xs text-[#6F7480]">{[place.categoryName, place.district].filter(Boolean).join(" · ")}</span>
                    </button>
                  </li>
                ))
              : posts.map((post) => (
                  <li key={post.id}>
                    <button
                      type="button"
                      className="w-full rounded-xl px-3 py-2 text-left hover:bg-brand/4"
                      onClick={() => {
                        void submit("post", { postId: post.id });
                        setPicker(null);
                      }}
                    >
                      <span className="line-clamp-2 block text-sm">{post.caption || "Bài viết"}</span>
                      {post.placeName ? <span className="text-xs text-[#6F7480]">{post.placeName}</span> : null}
                    </button>
                  </li>
                ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttachItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-brand/4">
      <Icon className="size-4" />
      {label}
    </button>
  );
}
