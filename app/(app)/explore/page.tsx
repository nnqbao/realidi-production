import { Suspense } from "react";
import { getDesiredMoods } from "@/features/mood/queries";
import { discoverPlaces, getMoodById } from "@/features/discovery/queries";
import { getSuggestedPeople } from "@/features/feed/queries";
import { MoodPicker } from "@/features/discovery/mood-picker";
import { FilterBar } from "@/features/discovery/filter-bar";
import { PlaceCard } from "@/features/discovery/place-card";
import { FollowButton } from "@/features/social/follow-button";
import { EmptyState, ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/lib/auth/session";
import { localizeName, vi } from "@/lib/i18n";
import { recordProductEvent } from "@/features/social/actions";
import { buildExploreShelves } from "@/lib/discovery/shelves";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import Link from "next/link";
import type { RankedPlaceCard } from "@/features/discovery/queries";
import { cn } from "@/lib/utils";
import { getPublishedFeaturedPlaces } from "@/features/curation/queries";
import { FeaturedPlacesStrip } from "@/features/curation/featured-places";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<ExploreSkeleton />}>
      <ExploreInner searchParams={searchParams} />
    </Suspense>
  );
}

async function loadExplore(params: Record<string, string | string[] | undefined>) {
  const moodId = typeof params.mood === "string" ? params.mood : null;
  if (!isSupabaseConfigured()) return { ok: false as const, reason: "unconfigured" as const };
  try {
    const [moods, selected, session, people, featured] = await Promise.all([
      getDesiredMoods(),
      getMoodById(moodId),
      getSessionUser(),
      getSuggestedPeople(4),
      getPublishedFeaturedPlaces("explore"),
    ]);
    const budgetMax = params.budget ? Number(params.budget) : null;
    const { places } = await discoverPlaces({
      moodId,
      nearLat: params.lat ? Number(params.lat) : null,
      nearLng: params.lng ? Number(params.lng) : null,
      radiusMeters: params.near === "1" ? 8000 : null,
      budgetMax,
      timeMinutes: params.time ? Number(params.time) : null,
      crowd: typeof params.crowd === "string" ? params.crowd : null,
      visitContext: typeof params.context === "string" ? params.context : null,
      categoryId: typeof params.category === "string" ? params.category : null,
      styleId: typeof params.style === "string" ? params.style : null,
      query: typeof params.q === "string" ? params.q : null,
    });
    await recordProductEvent("discovery_viewed", { mood_id: moodId, result_count: places.length, source: "explore" });
    return {
      ok: true as const,
      moodId,
      moods,
      selected,
      session,
      places,
      people,
      featured,
      budgetMax,
      nearDenied: params.near === "denied",
      hasLocation: Boolean(params.lat && params.lng),
    };
  } catch {
    return { ok: false as const, reason: "error" as const };
  }
}

async function ExploreInner({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const data = await loadExplore(params);
  if (!data.ok) {
    return (
      <ErrorState
        title="Không tải được khám phá"
        description="Thử lại sau. Bạn vẫn có thể xem Trang chủ."
      />
    );
  }

  const moodName = data.selected ? localizeName("vi", data.selected) : null;
  const shelves = buildExploreShelves(data.places, {
    moodSelected: Boolean(data.moodId),
    hasLocation: data.hasLocation,
    budgetMax: data.budgetMax,
  });

  return (
    <div className="px-4 py-4 md:px-2">
      <p className="text-sm text-muted-foreground">Khám phá · Sài Gòn</p>
      <h1 className="mt-2 font-display text-3xl md:text-4xl">{vi.discover.headline}</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">{vi.discover.support}</p>
      <div className="mt-5">
        <MoodPicker moods={data.moods} selectedId={data.moodId} basePath="/explore" />
      </div>
      <FilterBar basePath="/explore" />
      {data.nearDenied ? <p className="mt-3 text-sm text-muted-foreground">{vi.discover.locationDenied}</p> : null}
      <FeaturedPlacesStrip title="Biên tập chọn" places={data.featured} />

      {data.places.length === 0 ? (
        <EmptyState className="mt-8" title="Chưa có nơi khớp bộ lọc này" description={vi.discover.empty} />
      ) : (
        <div className="mt-8 space-y-10">
          {shelves.map((shelf) => (
            <section key={shelf.id}>
              <h2 className="font-display text-2xl">{shelf.title}</h2>
              <div
                className={cn(
                  "mt-4",
                  shelf.layout === "grid"
                    ? "grid gap-5 sm:grid-cols-2"
                    : "flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                )}
              >
                {shelf.places.map((place) => (
                  <div key={place.id} className={shelf.layout === "row" ? "w-[min(80vw,320px)] shrink-0" : undefined}>
                    <PlaceCard
                      place={place as RankedPlaceCard}
                      signedIn={Boolean(data.session)}
                      moodName={moodName}
                      moodId={data.moodId}
                      budgetMax={data.budgetMax}
                      compact={shelf.layout === "row"}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {data.people.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-display text-2xl">Người đáng theo dõi</h2>
          <ul className="mt-4 space-y-3">
            {data.people.map((person) => (
              <li
                key={person.id}
                className="flex items-center justify-between rounded-[20px] border border-subtle bg-surface px-4 py-3"
              >
                <Link href={`/user/${person.username}`}>
                  <p className="font-medium">{person.display_name}</p>
                  <p className="text-sm text-muted-foreground">@{person.username}</p>
                </Link>
                {data.session ? <FollowButton userId={person.id} initial={false} compact /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ExploreSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-16 w-full" />
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
    </div>
  );
}
