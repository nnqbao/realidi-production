import { api } from "@/convex/_generated/api";
import { convexQueryAuthed } from "@/lib/convex/server";
import { DEFAULT_RANKING_CONFIG, type RankingConfig } from "@/lib/ranking";
import type { ExperienceStyle, Mood, PlaceCategory } from "@/types/database";

export async function getDesiredMoods(): Promise<Mood[]> {
  return (await convexQueryAuthed(api.catalog.desiredMoods, {})) as Mood[];
}

export async function getCurrentStateMoods(): Promise<Mood[]> {
  return (await convexQueryAuthed(api.catalog.currentStateMoods, {})) as Mood[];
}

export async function getStyles(): Promise<ExperienceStyle[]> {
  return (await convexQueryAuthed(api.catalog.styles, {})) as ExperienceStyle[];
}

export async function getCategories(): Promise<PlaceCategory[]> {
  return (await convexQueryAuthed(api.catalog.categories, {})) as PlaceCategory[];
}

export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  return await convexQueryAuthed(api.flags.all, {});
}

export async function getRankingConfig(): Promise<RankingConfig> {
  const data = await convexQueryAuthed(api.catalog.rankingConfig, {});
  return data ?? DEFAULT_RANKING_CONFIG;
}
