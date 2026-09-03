"use client";

import { mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";
import { presenceAriaLabel } from "@/features/presence/format";
import { PRESENCE_DOT, type PresenceStatus } from "@/features/presence/types";

const DOT: Record<number, number> = {
  32: 8,
  36: 8,
  40: 9,
  44: 9,
  48: 10,
  56: 11,
  64: 12,
};

function dotSize(avatar: number) {
  if (DOT[avatar]) return DOT[avatar];
  if (avatar >= 64) return 12;
  if (avatar >= 48) return 10;
  if (avatar >= 40) return 9;
  return 8;
}

export function UserAvatar({
  name,
  src,
  size = 40,
  presence,
  lastActiveAt,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  presence?: PresenceStatus | null;
  lastActiveAt?: string | null;
  className?: string;
}) {
  const url = mediaSrc(src ?? null, "avatars");
  const showDot = presence && presence !== "hidden";
  const px = dotSize(size);
  const label = showDot ? presenceAriaLabel(presence, lastActiveAt) : undefined;
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <span
        className="inline-flex size-full items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-medium text-brand"
        aria-hidden={!name}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          name.slice(0, 1)
        )}
      </span>
      {showDot ? (
        <span
          className="absolute bottom-0 right-0 rounded-full ring-2 ring-background"
          style={{
            width: px,
            height: px,
            background: PRESENCE_DOT[presence],
          }}
          title={label}
          aria-label={label}
          role="img"
        />
      ) : null}
    </span>
  );
}
