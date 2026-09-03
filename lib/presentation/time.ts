const TIME_PERIOD_VI: Record<string, string> = {
  morning: "buổi sáng",
  afternoon: "buổi chiều",
  evening: "buổi tối",
  night: "ban đêm",
};

const DAY_TYPE_VI: Record<string, string> = {
  weekday: "ngày thường",
  weekend: "cuối tuần",
};

export type PlaceTimeStatsView = {
  sampleCount: number;
  tier: string;
  favoriteDayType: string | null;
  favoriteTimePeriod: string | null;
};

/** Only surface community favorite time when the sample is large enough. */
export function communityFavoriteTimeCopy(stats: PlaceTimeStatsView | null | undefined): string | null {
  if (!stats) return null;
  if (stats.tier === "early_signal" || stats.sampleCount < 5) return null;
  const parts: string[] = [];
  if (stats.favoriteTimePeriod && TIME_PERIOD_VI[stats.favoriteTimePeriod]) {
    parts.push(TIME_PERIOD_VI[stats.favoriteTimePeriod]);
  }
  if (stats.favoriteDayType && DAY_TYPE_VI[stats.favoriteDayType]) {
    parts.push(DAY_TYPE_VI[stats.favoriteDayType]);
  }
  return parts.length ? parts.join(" · ") : null;
}
