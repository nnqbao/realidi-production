"use client";

import { Button } from "@/components/ui/button";
import { recordProductEvent } from "@/features/social/actions";
import { googleMapsUrl } from "@/lib/urls/safe";

export function DirectionsButton({
  latitude,
  longitude,
  name,
  address,
  placeId,
}: {
  latitude?: number | null;
  longitude?: number | null;
  name: string;
  address?: string | null;
  placeId: string;
}) {
  const url = googleMapsUrl({ latitude, longitude, address, name });
  if (!url) return null;
  return (
    <Button asChild variant="outline">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          void recordProductEvent("directions_clicked", { place_id: placeId });
        }}
      >
        Chỉ đường
      </a>
    </Button>
  );
}
