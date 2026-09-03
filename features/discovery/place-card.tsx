import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDistance } from "@/lib/geo";
import { formatCompactVnd } from "@/lib/utils";
import { optimizedImageSrc } from "@/lib/media";
import { vi } from "@/lib/i18n";
import { experienceSignalCopy } from "@/lib/presentation/match";
import { SaveButton } from "@/features/places/save-button";
import { WhyThisMatch } from "./why-this-match";
import { RecommendationFeedback } from "./feedback-buttons";
import type { RankedPlaceCard } from "./queries";

export function PlaceCard({
  place,
  signedIn,
  moodName,
  moodId,
  budgetMax,
  compact = false,
}: {
  place: RankedPlaceCard;
  signedIn: boolean;
  moodName?: string | null;
  moodId?: string | null;
  budgetMax?: number | null;
  compact?: boolean;
}) {
  const image = optimizedImageSrc(place.cover_image_path, compact ? 480 : 800);
  const spend =
    place.typicalSpend != null
      ? place.typicalSpend
      : place.typical_spend_min != null
        ? place.typical_spend_min
        : null;
  const signal = experienceSignalCopy({
    match: place.match,
    confidenceTier: place.moodTier,
    experienceCount: place.experienceCount,
    verifiedCount: place.verifiedCount,
  });
  const showCrowd = Boolean(place.crowd) && place.crowdTier !== "early_signal";
  const showSpend = spend != null && (place.spendTier !== "early_signal" || spend === 0);

  return (
    <article className="overflow-hidden rounded-3xl border border-subtle bg-surface shadow-[var(--shadow-card)]">
      <Link href={`/place/${place.slug}`} className="block">
        <div className="relative aspect-[4/3] bg-muted">
          {image ? (
            <Image
              src={image}
              alt={place.name}
              fill
              className="object-cover"
              sizes={compact ? "240px" : "(max-width: 768px) 100vw, 340px"}
            />
          ) : null}
        </div>
      </Link>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/place/${place.slug}`} className="font-display text-xl leading-tight">
              {place.name}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              {place.category?.name_vi}
              {place.district ? ` · ${place.district}` : ""}
              {place.distanceMeters != null ? ` · ${formatDistance(place.distanceMeters)}` : ""}
            </p>
          </div>
          {signedIn ? <SaveButton placeId={place.id} initialSaved={false} compact /> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge title={signal.helper}>{signal.match}</Badge>
          <Badge variant="muted" title={signal.helper}>
            {signal.signal}
          </Badge>
          {place.isEditorialPick ? <Badge variant="pick">{vi.match.pick}</Badge> : null}
          {showCrowd ? (
            <Badge variant="outline">{vi.crowd[place.crowd as keyof typeof vi.crowd] ?? place.crowd}</Badge>
          ) : null}
          {showSpend && spend != null ? (
            <Badge variant="outline">{spend <= 0 ? "Miễn phí" : `~${formatCompactVnd(spend)}`}</Badge>
          ) : null}
        </div>
        <WhyThisMatch
          moodName={moodName}
          reasons={place.reasons}
          crowd={place.crowd}
          bestContext={place.bestContext}
          bestTime={place.bestTime}
          typicalSpend={place.typicalSpend}
          budgetMax={budgetMax ?? null}
          verifiedCount={place.verifiedCount}
          isEditorialPick={place.isEditorialPick}
          distanceMeters={place.distanceMeters}
        />
        {signedIn ? <RecommendationFeedback placeId={place.id} moodId={moodId} /> : null}
      </div>
    </article>
  );
}
