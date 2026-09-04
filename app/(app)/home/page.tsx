import { Suspense } from "react";
import { getDesiredMoods } from "@/features/mood/queries";
import { getFeedPage, getPlacesLite, getSuggestedPeople } from "@/features/feed/queries";
import { FeedSwitcher } from "@/features/feed/components/FeedSwitcher";
import { MoodStrip } from "@/features/feed/components/MoodStrip";
import { PostComposer } from "@/features/feed/components/PostComposer";
import { HomeFeed } from "@/features/feed/components/HomeFeed";
import { getSessionUser } from "@/lib/auth/session";
import { recordProductEvent } from "@/features/social/actions";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublishedFeaturedPlaces } from "@/features/curation/queries";
import { FeaturedPlacesStrip } from "@/features/curation/featured-places";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeInner searchParams={searchParams} />
    </Suspense>
  );
}

async function HomeInner({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab = params.tab === "following" ? "following" : "for_you";
  const moodId = typeof params.mood === "string" ? params.mood : null;

  const [session, moods, places, feed, suggested, featured] = await Promise.all([
    getSessionUser().catch(() => null),
    getDesiredMoods().catch(() => []),
    getPlacesLite().catch(() => []),
    getFeedPage({ type: tab, moodId }).catch(() => ({ posts: [], nextCursor: null, followingEmpty: false })),
    getSuggestedPeople(5).catch(() => []),
    getPublishedFeaturedPlaces("home").catch(() => []),
  ]);

  await recordProductEvent("feed_loaded", {
    feed_type: tab,
    selected_mood: moodId,
    result_count: feed.posts.length,
  });

  return (
    <div>
      <FeedSwitcher />
      <MoodStrip moods={moods} selectedId={moodId} />
      {tab === "for_you" ? <FeaturedPlacesStrip title="Nơi nổi bật" places={featured} /> : null}
      {session ? (
        <PostComposer
          user={{
            id: session.user.id,
            display_name: session.profile.display_name,
            avatar_path: session.profile.avatar_path,
          }}
          places={places}
          moods={moods}
        />
      ) : null}
      <HomeFeed
        key={`${tab}-${moodId ?? "none"}`}
        initial={feed.posts}
        nextCursor={feed.nextCursor}
        feedType={tab}
        moodId={moodId}
        currentUserId={session?.user.id}
        followingEmpty={tab === "following" && feed.followingEmpty}
        suggested={suggested}
      />
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-10" />
      <Skeleton className="h-16" />
      <Skeleton className="h-72" />
    </div>
  );
}
