"use client";

import { UserAvatar } from "@/components/ui/user-avatar";
import { usePresence } from "@/features/presence/provider";
import { presenceCopy } from "@/features/presence/format";
import { formatCity } from "@/lib/utils";

export function ProfileIdentity({
  person,
}: {
  person: {
    id: string;
    display_name: string;
    username: string;
    avatar_path: string | null;
    bio: string | null;
    home_city: string | null;
    last_seen_at?: string | null;
    last_active_at?: string | null;
    show_activity_status?: boolean | null;
  };
}) {
  const presence = usePresence();
  const snap = presence.getUserPresence(
    person.id,
    person.last_active_at ?? person.last_seen_at ?? null,
    person.show_activity_status,
  );
  const label = presenceCopy(snap.status, snap.lastActiveAt);
  const show = snap.status !== "hidden";
  return (
    <div className="flex items-start gap-4">
      <UserAvatar
        name={person.display_name}
        src={person.avatar_path}
        size={80}
        presence={show ? snap.status : null}
        lastActiveAt={snap.lastActiveAt}
      />
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold">{person.display_name}</h1>
        <p className="text-muted-foreground">@{person.username}</p>
        {show && label ? <p className="mt-1 text-sm text-[#6F7480]">{label}</p> : null}
        <p className="mt-3 max-w-xl text-sm">{person.bio ?? "Chưa có mô tả."}</p>
        {person.home_city ? <p className="mt-1 text-sm text-muted-foreground">{formatCity(person.home_city)}</p> : null}
      </div>
    </div>
  );
}
