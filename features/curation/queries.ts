import { api } from "@/convex/_generated/api";
import { convexQueryAuthed } from "@/lib/convex/server";

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
    return await convexQueryAuthed(api.curation.featuredPlaces, { surface });
  } catch {
    return [];
  }
}
