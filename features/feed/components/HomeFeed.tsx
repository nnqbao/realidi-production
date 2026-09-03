"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExperiencePost } from "./ExperiencePost";
import { FollowButton } from "@/features/social/follow-button";
import { Skeleton } from "@/components/ui/skeleton";
import type { FeedPost } from "../types";

type Person = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
};

export function HomeFeed({
  initial,
  nextCursor,
  feedType,
  moodId,
  currentUserId,
  followingEmpty,
  suggested,
}: {
  initial: FeedPost[];
  nextCursor: number | null;
  feedType: "for_you" | "following";
  moodId: string | null;
  currentUserId?: string | null;
  followingEmpty?: boolean;
  suggested?: Person[];
}) {
  const [extra, setExtra] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState(nextCursor);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const posts = [...initial, ...extra];

  useEffect(() => {
    const node = sentinel.current;
    if (!node || cursor == null) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || loading || cursor == null) return;
        setLoading(true);
        const params = new URLSearchParams({
          type: feedType,
          cursor: String(cursor),
        });
        if (moodId) params.set("mood", moodId);
        void fetch(`/api/feed?${params}`)
          .then((res) => res.json())
          .then((data: { posts: FeedPost[]; nextCursor: number | null }) => {
            setExtra((prev) => [...prev, ...data.posts]);
            setCursor(data.nextCursor);
          })
          .finally(() => setLoading(false));
      },
      { rootMargin: "400px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [cursor, feedType, loading, moodId]);

  return (
    <div className="space-y-4 px-0 pb-8 md:px-0">
      {followingEmpty ? (
        <div className="mx-4 rounded-[20px] border border-dashed border-subtle bg-surface px-4 py-5">
          <p className="font-medium">Theo dõi một vài người để cá nhân hóa bảng tin.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Đây là những trải nghiệm đang được quan tâm — hãy theo dõi người viết.
          </p>
          {suggested && suggested.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {suggested.map((person) => (
                <li key={person.id} className="flex items-center justify-between gap-3">
                  <Link href={`/user/${person.username}`} className="min-w-0">
                    <span className="block truncate font-medium">{person.display_name}</span>
                    <span className="text-sm text-muted-foreground">@{person.username}</span>
                  </Link>
                  <FollowButton userId={person.id} initial={false} compact />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {posts.length === 0 ? (
        <div className="mx-4 rounded-[20px] border border-dashed border-border px-4 py-10 text-center">
          <p className="font-medium">Chưa có trải nghiệm mới</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Theo dõi người khác, hoặc{" "}
            <Link href="/explore" className="underline">
              khám phá nơi
            </Link>{" "}
            rồi chia sẻ trải nghiệm đầu tiên.
          </p>
        </div>
      ) : (
        posts.map((post) => (
          <ExperiencePost key={post.id} post={post} currentUserId={currentUserId} feedType={feedType} />
        ))
      )}
      {loading ? (
        <div className="space-y-3 px-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      ) : null}
      <div ref={sentinel} className="h-8" />
    </div>
  );
}
