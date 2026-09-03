"use client";

import Link from "next/link";
import { FollowButton } from "@/features/social/follow-button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { usePresence } from "@/features/presence/provider";
import { localizeName } from "@/lib/i18n";
import type { Mood } from "@/types/database";

type Person = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  bio?: string | null;
};

type PlaceLite = {
  id: string;
  slug: string;
  name: string;
  district: string | null;
  cover_image_path: string | null;
};

export function RightSidebar({
  people,
  places,
  moods,
}: {
  people: Person[];
  places: PlaceLite[];
  moods: Mood[];
}) {
  const presence = usePresence();
  return (
        <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 overflow-y-auto py-6 pl-2 pr-4 min-[1440px]:block min-[1440px]:w-[300px]">
      <section>
        <h2 className="text-sm font-semibold text-brand">Gợi ý theo dõi</h2>
        <ul className="mt-3 space-y-3">
          {people.map((person) => (
            <li key={person.id} className="flex items-center gap-2">
              <Link href={`/user/${person.username}`} className="flex min-w-0 flex-1 items-center gap-2">
                <UserAvatar
                  name={person.display_name}
                  src={person.avatar_path}
                  size={36}
                  presence={(() => {
                    const status = presence.getUserPresence(person.id).status;
                    return status === "hidden" ? null : status;
                  })()}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{person.display_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">@{person.username}</span>
                </span>
              </Link>
              <FollowButton userId={person.id} initial={false} compact />
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-brand">Nơi đang được quan tâm</h2>
        <ul className="mt-3 space-y-2">
          {places.map((place) => (
            <li key={place.id}>
              <Link href={`/place/${place.slug}`} className="block rounded-xl px-2 py-1.5 text-sm hover:bg-brand/4">
                <span className="font-medium">{place.name}</span>
                {place.district ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{place.district}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-brand">Mood phổ biến</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {moods.slice(0, 6).map((mood) => (
            <Link
              key={mood.id}
              href={`/home?mood=${mood.id}`}
              className="rounded-full border border-brand/12 bg-surface px-3 py-1.5 text-xs text-brand hover:bg-brand/4"
            >
              {localizeName("vi", mood)}
            </Link>
          ))}
        </div>
      </section>
      <p className="mt-10 text-xs text-muted-foreground">
        <Link href="/explore" className="underline-offset-2 hover:underline">
          Khám phá nơi và mood
        </Link>
      </p>
    </aside>
  );
}
