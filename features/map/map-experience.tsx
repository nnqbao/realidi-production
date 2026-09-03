"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { optimizedImageSrc } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { MapPlacePin } from "./types";

const MapboxMap = dynamic(() => import("@/lib/geo/mapbox-map").then((m) => m.MapboxMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted" />,
});

export function MapExperience({
  token,
  places,
}: {
  token: string | null;
  places: MapPlacePin[];
}) {
  const [selectedId, setSelectedId] = useState(places[0]?.id ?? null);
  const selected = useMemo(
    () => places.find((p) => p.id === selectedId) ?? places[0] ?? null,
    [places, selectedId],
  );
  const image = selected ? optimizedImageSrc(selected.cover_image_path, 640) : null;
  const interactive = Boolean(token);

  return (
    <div className="mt-4 md:grid md:grid-cols-[minmax(0,18rem)_1fr] md:gap-4 md:items-start">
      <ul className="hidden max-h-[70vh] space-y-2 overflow-y-auto md:block">
        {places.map((place) => (
          <li key={place.id}>
            <button
              type="button"
              onClick={() => setSelectedId(place.id)}
              className={cn(
                "w-full rounded-2xl border px-3 py-3 text-left text-sm",
                selectedId === place.id ? "border-brand bg-brand/6" : "border-subtle bg-surface hover:bg-brand/4",
              )}
            >
              <span className="font-medium">{place.name}</span>
              {place.district ? <span className="mt-0.5 block text-xs text-muted-foreground">{place.district}</span> : null}
            </button>
          </li>
        ))}
      </ul>

      <div
        className={cn(
          "relative overflow-hidden rounded-3xl bg-muted",
          interactive ? "h-[min(72vh,640px)] md:h-[min(70vh,640px)]" : "min-h-[220px]",
        )}
      >
        {token ? (
          <MapboxMap token={token} places={places} selectedId={selectedId} onSelect={setSelectedId} />
        ) : (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
            <p className="font-medium">Bản đồ đang được cập nhật</p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Bạn vẫn có thể chọn địa điểm bên dưới và xem chỉ đường khi sẵn sàng đi.
            </p>
          </div>
        )}

        {selected ? (
          <Link
            href={`/place/${selected.slug}`}
            className="absolute inset-x-3 bottom-3 flex gap-3 rounded-2xl border border-subtle bg-surface p-3 shadow-[var(--shadow-card)] md:inset-x-auto md:right-3 md:w-72"
          >
            {image ? (
              <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                <Image src={image} alt="" fill className="object-cover" sizes="64px" />
              </span>
            ) : (
              <span className="size-16 shrink-0 rounded-xl bg-muted" />
            )}
            <span className="min-w-0">
              <span className="block truncate font-medium">{selected.name}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{selected.district}</span>
              <span className="mt-1 block text-xs text-brand">Xem nơi này</span>
            </span>
          </Link>
        ) : null}
      </div>

      {!interactive ? (
        <ul className="mt-4 space-y-2 md:hidden">
          {places.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => setSelectedId(place.id)}
                className={cn(
                  "w-full rounded-2xl border px-3 py-3 text-left text-sm",
                  selectedId === place.id ? "border-brand bg-brand/6" : "border-subtle bg-surface",
                )}
              >
                <span className="font-medium">{place.name}</span>
                {place.district ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{place.district}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
