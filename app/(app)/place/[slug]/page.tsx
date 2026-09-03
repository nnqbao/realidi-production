import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getPlaceBySlug } from "@/features/places/queries";
import { SaveButton } from "@/features/places/save-button";
import { BeenThereButton } from "@/features/places/been-there-button";
import { DirectionsButton } from "@/features/places/directions-button";
import { VerifyVisitButton } from "@/features/verification/verify-button";
import { EmptyState, ErrorState } from "@/components/states";
import { formatSpendPerPerson, formatCity, formatDistrict } from "@/lib/utils";
import { getMapProvider } from "@/lib/geo";
import { localizeName, vi } from "@/lib/i18n";
import { getSessionUser } from "@/lib/auth/session";
import { recordProductEvent } from "@/features/social/actions";
import { ExperiencePost } from "@/features/feed/components/ExperiencePost";
import { getFeedPostsForPlace } from "@/features/feed/queries";
import { WhyThisMatch } from "@/features/discovery/why-this-match";
import { experienceSignalCopy } from "@/lib/presentation/match";
import { communityFavoriteTimeCopy } from "@/lib/presentation/time";
import { optimizedImageSrc } from "@/lib/media";
import { matchLabel, type ConfidenceTier } from "@/lib/ranking";
import { Badge } from "@/components/ui/badge";
import { ShareSheet } from "@/features/share/share-sheet";
import { InviteToPlaceButton } from "@/features/places/invite-button";
import { googleMapsUrl, safeHttpUrl } from "@/lib/urls/safe";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const data = await getPlaceBySlug(slug);
    if (!data) return { title: "Không tìm thấy nơi" };
    return {
      title: data.place.name,
      description: data.place.short_description ?? data.place.description ?? undefined,
      alternates: { canonical: `/place/${data.place.slug}` },
      openGraph: {
        title: data.place.name,
        description: data.place.short_description ?? undefined,
        images: data.place.cover_image_path ? [{ url: data.place.cover_image_path }] : undefined,
      },
    };
  } catch {
    return { title: "Realidi" };
  }
}

export default async function PlacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let data;
  try {
    data = await getPlaceBySlug(slug);
  } catch {
    return (
      <ErrorState
        title="Không tải được nơi này"
        description="Thử lại sau. Bạn vẫn có thể khám phá nơi khác."
      />
    );
  }
  if (!data) notFound();
  if (data.mergedIntoSlug) redirect(`/place/${data.mergedIntoSlug}`);

  const session = await getSessionUser().catch(() => null);
  const { place } = data;
  const communityPosts = await getFeedPostsForPlace(place.id).catch(() => []);
  await recordProductEvent("place_opened", { place_id: place.id, source: "place_page" });

  const map = getMapProvider();
  const staticMap =
    place.latitude != null && place.longitude != null
      ? map.staticMapUrl({ latitude: place.latitude, longitude: place.longitude })
      : null;
  const cover = optimizedImageSrc(place.cover_image_path, 900);
  const showSpend = data.cost && data.cost.tier !== "early_signal" && data.cost.median != null;
  const showCrowd = data.crowd && data.crowd.tier !== "early_signal" && data.crowd.dominant;
  const showWorth = data.experienceStats && data.experienceStats.tier !== "early_signal" && data.experienceStats.worthIt;
  const topMood = data.moodProfile[0];
  const match = topMood
    ? matchLabel(topMood.tier as ConfidenceTier, topMood.avg != null ? topMood.avg / 5 : 0.5)
    : "early_signal";
  const signal = experienceSignalCopy({
    match,
    confidenceTier: topMood?.tier ?? data.experienceStats?.tier ?? "early_signal",
    experienceCount: data.experienceStats?.sampleCount ?? 0,
    verifiedCount: data.experienceStats?.verifiedCount ?? 0,
  });
  const favoriteTime = communityFavoriteTimeCopy(data.timeStats);
  const isPick = Boolean(place.verified_by_admin) || Number(place.editorial_score) >= 0.84;
  const lowData = (data.experienceStats?.tier ?? "early_signal") === "early_signal" || (data.experienceStats?.sampleCount ?? 0) < 5;
  const sampleCount = data.experienceStats?.sampleCount ?? 0;

  return (
    <article>
      <div className="relative aspect-[16/10] overflow-hidden bg-muted md:rounded-3xl">
        {cover ? (
          <Image src={cover} alt={place.name} fill className="object-cover" priority sizes="(max-width: 768px) 100vw, 680px" />
        ) : null}
      </div>
      <header className="mt-6">
        <p className="text-sm text-muted-foreground">
          {data.category?.name_vi}
          {place.district ? ` · ${formatDistrict(place.district)}` : ""} · {formatCity(place.city)}
        </p>
        <h1 className="mt-1 font-display text-3xl md:text-4xl">{place.name}</h1>
        {place.short_description ? <p className="mt-3 max-w-2xl text-muted-foreground">{place.short_description}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge title={signal.helper}>{signal.match}</Badge>
          <Badge variant="muted" title={signal.helper}>
            {signal.signal}
          </Badge>
          {isPick ? <Badge variant="pick">{vi.match.pick}</Badge> : null}
        </div>
        <WhyThisMatch
          className="mt-3"
          moodName={topMood ? localizeName("vi", topMood.mood) : null}
          reasons={topMood && topMood.tier !== "early_signal" ? ["mood_moderate"] : []}
          crowd={data.crowd?.dominant ?? null}
          bestContext={data.experienceStats?.bestContext ?? null}
          bestTime={data.experienceStats?.bestTime ?? null}
          typicalSpend={data.cost?.median ?? null}
          budgetMax={null}
          verifiedCount={data.experienceStats?.verifiedCount ?? 0}
          isEditorialPick={isPick}
          distanceMeters={null}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <SaveButton placeId={place.id} initialSaved={data.saved} />
          <BeenThereButton placeId={place.id} initial={data.beenThere} />
          <DirectionsButton
            latitude={place.latitude}
            longitude={place.longitude}
            address={place.address}
            name={place.name}
            placeId={place.id}
          />
          <ShareSheet
            path={`/place/${place.slug}`}
            kind="place"
            placeId={place.id}
            payload={{ placeId: place.id, placeName: place.name, placeSlug: place.slug, placeDistrict: place.district }}
          />
          {session ? <InviteToPlaceButton placeId={place.id} placeName={place.name} /> : null}
        </div>
      </header>

      {lowData ? (
        <section className="mt-8 rounded-3xl border border-subtle bg-surface p-5">
          <p className="font-medium">Dữ liệu cộng đồng đang được hình thành.</p>
          {sampleCount > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Hiện có {sampleCount} trải nghiệm được chia sẻ trên Realidi.</p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Chia sẻ trải nghiệm đầu tiên để nơi này rõ hơn.</p>
          )}
        </section>
      ) : (
      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        <IntelCard title={vi.place.moodMatch}>
          {topMood ? (
            <p>
              {localizeName("vi", topMood.mood)} · {signal.match}
            </p>
          ) : (
            <p className="text-muted-foreground">Chưa có đánh giá mood từ cộng đồng.</p>
          )}
        </IntelCard>
        <IntelCard title={vi.place.emotionalProfile}>
          {data.moodProfile.length ? (
            <ul className="space-y-1">
              {data.moodProfile.slice(0, 4).map((row) => (
                <li key={row.mood.id} className="flex justify-between text-sm">
                  <span>{localizeName("vi", row.mood)}</span>
                  <span className="text-muted-foreground">
                    {row.avg == null ? null : `${Math.round(row.avg * 10) / 10}/5`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Chưa có đánh giá mood từ cộng đồng.</p>
          )}
        </IntelCard>
        <IntelCard title={vi.place.verifiedSignal}>
          <p>
            {data.experienceStats?.verifiedCount ?? 0} trải nghiệm đã xác minh trên {data.experienceStats?.sampleCount ?? 0}
          </p>
        </IntelCard>
        <IntelCard title={vi.place.intelligence}>
          <ul className="space-y-1 text-sm">
            {showWorth ? <li>{vi.place.worthIt}: {Math.round((showWorth as number) * 10) / 10}/5</li> : null}
            {showCrowd ? <li>{vi.place.crowd}: {vi.crowd[showCrowd as keyof typeof vi.crowd]}</li> : null}
            {showSpend ? (
              <li>
                {vi.place.spend}: {formatSpendPerPerson(data.cost!.median)}
              </li>
            ) : null}
            {data.experienceStats?.bestContext ? (
              <li>
                {vi.place.visitContext}: {vi.context[data.experienceStats.bestContext as keyof typeof vi.context]}
              </li>
            ) : null}
          </ul>
        </IntelCard>
      </section>
      )}

      {favoriteTime ? (
        <section className="mt-6 rounded-3xl border border-subtle bg-surface p-5">
          <h2 className="text-sm font-medium text-muted-foreground">{vi.place.favoriteTime}</h2>
          <p className="mt-2">{favoriteTime}</p>
        </section>
      ) : null}

      {session ? (
        <div className="mt-6">
          <VerifyVisitButton placeId={place.id} />
        </div>
      ) : null}

      <section className="mt-10">
        <h2 className="font-display text-2xl">{vi.place.community}</h2>
        {communityPosts.length === 0 ? (
          <EmptyState className="mt-4" title="Chưa có trải nghiệm" description={vi.place.noExperiences} />
        ) : (
          <div className="mt-4 space-y-4">
            {communityPosts.map((post) => (
              <ExperiencePost key={post.id} post={post} currentUserId={session?.user.id} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">{vi.place.facts}</h2>
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          {place.address ? <p>{place.address}</p> : null}
          {safeHttpUrl(place.website) ? (
            <p>
              <a className="font-medium text-brand underline" href={safeHttpUrl(place.website)!} rel="noopener noreferrer" target="_blank">
                {place.website}
              </a>
            </p>
          ) : null}
          {place.typical_duration_minutes ? <p>Thời gian gợi ý: ~{place.typical_duration_minutes} phút</p> : null}
        </div>
        {staticMap ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={staticMap} alt={`Bản đồ ${place.name}`} className="mt-4 w-full rounded-3xl" />
        ) : (
          <div className="mt-4 rounded-3xl border border-subtle bg-surface p-5">
            <p className="font-medium text-brand">{place.address || place.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">Mở Google Maps để xem vị trí và chỉ đường.</p>
            {googleMapsUrl({
              latitude: place.latitude,
              longitude: place.longitude,
              address: place.address,
              name: place.name,
            }) ? (
              <a
                className="mt-3 inline-flex min-h-11 items-center font-medium text-brand underline"
                href={googleMapsUrl({
                  latitude: place.latitude,
                  longitude: place.longitude,
                  address: place.address,
                  name: place.name,
                })!}
                target="_blank"
                rel="noopener noreferrer"
              >
                Mở trong Google Maps
              </a>
            ) : null}
          </div>
        )}
      </section>
    </article>
  );
}

function IntelCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-subtle bg-surface p-5">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
