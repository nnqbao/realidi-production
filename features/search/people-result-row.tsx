"use client";

import Link from "next/link";
import { FollowButton } from "@/features/social/follow-button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { usePresence } from "@/features/presence/provider";

export function PeopleResultRow({
  person,
  currentUserId,
}: {
  person: {
    id: string;
    username: string;
    display_name: string;
    avatar_path?: string | null;
    last_active_at?: string | null;
    last_seen_at?: string | null;
    show_activity_status?: boolean | null;
  };
  currentUserId?: string | null;
}) {
  const presence = usePresence();
  const snap = presence.getUserPresence(
    person.id,
    person.last_active_at ?? person.last_seen_at ?? null,
    person.show_activity_status,
  );
  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-subtle bg-surface p-4">
      <Link href={`/user/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <UserAvatar
          name={person.display_name}
          src={person.avatar_path}
          size={44}
          presence={snap.status === "hidden" ? null : snap.status}
          lastActiveAt={snap.lastActiveAt}
        />
        <span className="min-w-0">
          <span className="block truncate font-medium">{person.display_name}</span>
          <span className="block truncate text-sm text-muted-foreground">@{person.username}</span>
        </span>
      </Link>
      {currentUserId && currentUserId !== person.id ? <FollowButton userId={person.id} initial={false} compact /> : null}
    </div>
  );
}
