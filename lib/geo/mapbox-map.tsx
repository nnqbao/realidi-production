"use client";

import { useEffect, useRef, useState } from "react";
import type { MapPlacePin } from "@/features/map/types";

export function MapboxMap({
  token,
  places,
  selectedId,
  onSelect,
}: {
  token: string;
  places: MapPlacePin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove: () => void; flyTo: (opts: object) => void } | null>(null);
  const onSelectRef = useRef(onSelect);
  const [failed, setFailed] = useState(false);
  const placeKey = places.map((p) => p.id).join(",");

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!container.current || places.length === 0) return;
    let cancelled = false;
    const first = places[0];

    void (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        await import("mapbox-gl/dist/mapbox-gl.css");
        if (cancelled || !container.current) return;
        mapboxgl.accessToken = token;
        const map = new mapboxgl.Map({
          container: container.current,
          style: "mapbox://styles/mapbox/light-v11",
          center: [first.longitude, first.latitude],
          zoom: 12.2,
          attributionControl: false,
        });
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
        for (const place of places) {
          const el = document.createElement("button");
          el.type = "button";
          el.className = "size-3 rounded-full border-2 border-white bg-brand/60 shadow";
          el.setAttribute("aria-label", place.name);
          el.addEventListener("click", (event) => {
            event.stopPropagation();
            onSelectRef.current(place.id);
          });
          new mapboxgl.Marker({ element: el }).setLngLat([place.longitude, place.latitude]).addTo(map);
        }
        mapRef.current = map;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [token, placeKey, places]);

  useEffect(() => {
    const selected = places.find((p) => p.id === selectedId);
    const map = mapRef.current;
    if (!selected || !map) return;
    map.flyTo({ center: [selected.longitude, selected.latitude], zoom: 13.4, essential: true });
  }, [selectedId, places]);

  if (failed) return null;
  return <div ref={container} className="h-full min-h-[320px] w-full bg-muted" />;
}
