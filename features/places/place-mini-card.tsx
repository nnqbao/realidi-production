import Link from "next/link";
import Image from "next/image";
import { optimizedImageSrc } from "@/lib/media";

export function PlaceMiniCard({
  place,
}: {
  place: {
    slug: string;
    name: string;
    district: string | null;
    categoryName?: string | null;
    cover_image_path?: string | null;
  };
}) {
  const image = optimizedImageSrc(place.cover_image_path, 320);
  return (
    <Link
      href={`/place/${place.slug}`}
      className="mt-2 flex gap-3 overflow-hidden rounded-2xl border border-subtle bg-surface p-2"
    >
      {image ? (
        <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
          <Image src={image} alt="" fill className="object-cover" sizes="56px" />
        </span>
      ) : (
        <span className="size-14 shrink-0 rounded-xl bg-muted" />
      )}
      <span className="min-w-0 py-0.5">
        <span className="block truncate font-medium">{place.name}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {[place.categoryName, place.district].filter(Boolean).join(" · ")}
        </span>
        <span className="mt-1 block text-xs text-brand">Xem địa điểm</span>
      </span>
    </Link>
  );
}
