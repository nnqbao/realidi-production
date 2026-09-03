import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getDesiredMoods, getCategories } from "@/features/mood/queries";
import { MoodPicker } from "@/features/discovery/mood-picker";
import { getSessionUser } from "@/lib/auth/session";
import { MapExperience } from "@/features/map/map-experience";
import { EmptyState, ErrorState } from "@/components/states";
import { localizeName } from "@/lib/i18n";
import { getMapProvider } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type { MapPlacePin } from "@/features/map/types";
import type { Mood, PlaceCategory } from "@/types/database";

async function loadMap(mood?: string, category?: string) {
  await getSessionUser().catch(() => null);
  const supabase = await createServerSupabase();
  const [moods, categories] = await Promise.all([
    getDesiredMoods().catch(() => []),
    getCategories().catch(() => []),
  ]);

  let placeQuery = supabase
    .from("places")
    .select("id, slug, name, district, latitude, longitude, cover_image_path, category_id")
    .eq("status", "active")
    .not("latitude", "is", null)
    .order("editorial_score", { ascending: false })
    .limit(40);

  if (category) placeQuery = placeQuery.eq("category_id", category);

  let { data: places } = await placeQuery;
  if (mood && places?.length) {
    const { data: moodLinks } = await supabase.from("place_moods").select("place_id").eq("mood_id", mood);
    const allowed = new Set((moodLinks ?? []).map((row) => row.place_id));
    places = places.filter((p) => allowed.has(p.id));
  }

  const pins: MapPlacePin[] = (places ?? []).flatMap((place) =>
    place.latitude != null && place.longitude != null
      ? [
          {
            id: place.id,
            slug: place.slug,
            name: place.name,
            district: place.district,
            latitude: place.latitude,
            longitude: place.longitude,
            cover_image_path: place.cover_image_path,
          },
        ]
      : [],
  );

  return { moods, categories, pins, token: getMapProvider().publicToken() };
}

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ mood?: string; category?: string }>;
}) {
  const { mood, category } = await searchParams;
  let data: { moods: Mood[]; categories: PlaceCategory[]; pins: MapPlacePin[]; token: string | null };
  try {
    data = await loadMap(mood, category);
  } catch {
    return (
      <ErrorState title="Không tải được bản đồ" description="Thử lại sau. Bạn vẫn có thể khám phá nơi trên Khám phá." />
    );
  }

  return (
    <div className="px-4 py-4">
      <h1 className="text-2xl font-semibold">Bản đồ</h1>
      <p className="mt-1 text-sm text-muted-foreground">Xem nơi trên bản đồ, rồi mở trang địa điểm khi bạn muốn đi.</p>
      <div className="mt-4">
        <MoodPicker moods={data.moods} selectedId={mood ?? null} basePath="/map" />
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href={mood ? `/map?mood=${mood}` : "/map"}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-sm",
            !category ? "border-brand bg-brand text-white" : "border-brand/12 bg-surface text-brand",
          )}
        >
          Tất cả
        </Link>
        {data.categories.slice(0, 8).map((item) => (
          <Link
            key={item.id}
            href={`/map?${new URLSearchParams({ ...(mood ? { mood } : {}), category: item.id }).toString()}`}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm",
              category === item.id ? "border-brand bg-brand text-white" : "border-brand/12 bg-surface text-brand",
            )}
          >
            {localizeName("vi", item)}
          </Link>
        ))}
      </div>
      {data.pins.length === 0 ? (
        <EmptyState className="mt-8" title="Chưa có địa điểm trên bản đồ" description="Thử đổi mood hoặc loại hình." />
      ) : (
        <MapExperience token={data.token} places={data.pins} />
      )}
    </div>
  );
}
