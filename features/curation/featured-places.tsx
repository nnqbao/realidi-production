import Link from "next/link";
import type { FeaturedPlaceLite } from "./queries";

export function FeaturedPlacesStrip({
  title,
  places,
}: {
  title: string;
  places: FeaturedPlaceLite[];
}) {
  if (!places.length) return null;
  return (
    <section className="px-4 py-4 md:px-2">
      <h2 className="font-display text-2xl">{title}</h2>
      <ul className="mt-3 flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {places.map((place) => (
          <li key={place.id} className="w-[min(78vw,280px)] shrink-0">
            <Link
              href={`/place/${place.slug}`}
              className="block rounded-[20px] border border-subtle bg-surface p-4 shadow-[var(--shadow-card)]"
            >
              <p className="font-medium">{place.name}</p>
              <p className="mt-1 text-sm text-[#6F7480]">{place.district ?? place.short_description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
