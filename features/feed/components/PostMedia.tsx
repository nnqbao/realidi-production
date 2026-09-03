"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { optimizedImageSrc } from "@/lib/media";
import type { FeedMedia } from "../types";

export function PostMedia({ media }: { media: FeedMedia[] }) {
  const [index, setIndex] = useState(0);
  if (media.length === 0) return null;
  const current = media[Math.min(index, media.length - 1)];

  return (
    <div className="relative overflow-hidden bg-muted">
      <div className="flex max-h-[min(72vh,720px)] items-center justify-center">
        {current.type === "video" ? (
          <video
            className="max-h-[min(72vh,720px)] w-full object-contain"
            controls
            playsInline
            poster={current.thumbnailUrl ?? undefined}
            src={current.url}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={optimizedImageSrc(current.url, 1080) ?? current.url}
            alt=""
            loading="lazy"
            decoding="async"
            className="max-h-[min(72vh,720px)] w-full object-contain"
          />
        )}
      </div>
      {media.length > 1 ? (
        <>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {media.map((item, i) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Ảnh ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn("size-1.5 rounded-full", i === index ? "bg-white" : "bg-white/50")}
              />
            ))}
          </div>
          {index > 0 ? (
            <button
              type="button"
              className="absolute left-2 top-1/2 size-9 -translate-y-1/2 rounded-full bg-black/40 text-white"
              onClick={() => setIndex((i) => i - 1)}
              aria-label="Trước"
            >
              ‹
            </button>
          ) : null}
          {index < media.length - 1 ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 size-9 -translate-y-1/2 rounded-full bg-black/40 text-white"
              onClick={() => setIndex((i) => i + 1)}
              aria-label="Sau"
            >
              ›
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
