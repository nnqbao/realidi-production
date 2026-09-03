import { createServerSupabase } from "@/lib/supabase/server";

export type FeaturedPlaceLite = {
  id: string;
  name: string;
  slug: string;
  district: string | null;
  cover_image_path: string | null;
  short_description: string | null;
};

export async function getPublishedFeaturedPlaces(surface: "home" | "explore"): Promise<FeaturedPlaceLite[]> {
  try {
    const supabase = await createServerSupabase();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("featured_placements")
      .select("target_id, sort_order, starts_at, ends_at")
      .eq("surface", surface)
      .eq("target_type", "place")
      .eq("status", "published")
      .order("sort_order");
    if (error || !data?.length) return [];
    const ids = data
      .filter((row) => (!row.starts_at || row.starts_at <= now) && (!row.ends_at || row.ends_at >= now))
      .map((row) => row.target_id);
    if (!ids.length) return [];
    const { data: places } = await supabase
      .from("places")
      .select("id, name, slug, district, cover_image_path, short_description")
      .in("id", ids)
      .eq("status", "active")
      .is("deleted_at", null);
    const order = new Map(ids.map((id, i) => [id, i]));
    return (places ?? []).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  } catch {
    return [];
  }
}
