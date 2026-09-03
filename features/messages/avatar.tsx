"use client";

import { UserAvatar } from "@/components/ui/user-avatar";
import type { PresenceStatus } from "@/features/presence/types";

export function ChatAvatar({
  name,
  src,
  size = 40,
  presence,
  lastActiveAt,
}: {
  name: string;
  src?: string | null;
  size?: number;
  presence?: PresenceStatus | null;
  lastActiveAt?: string | null;
}) {
  return <UserAvatar name={name} src={src} size={size} presence={presence} lastActiveAt={lastActiveAt} />;
}

export { UserAvatar as PresenceDotHost };
