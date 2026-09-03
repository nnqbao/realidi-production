export type ExploreShelfId =
  | "mood"
  | "nearby"
  | "solo"
  | "trending"
  | "picks"
  | "budget";

export type ExploreShelfPlace = {
  id: string;
  match: "early_signal" | "good_match" | "strong_match";
  moodScore: number;
  distanceMeters: number | null;
  typicalSpend: number | null;
  spendTier: string;
  bestContext: string | null;
  experienceCount: number;
  verifiedCount: number;
  isEditorialPick: boolean;
  rankingPosition: number;
};

export type ExploreShelf<T extends ExploreShelfPlace> = {
  id: ExploreShelfId;
  title: string;
  layout: "grid" | "row";
  places: T[];
};

const SHELF_SIZE = {
  mood: 8,
  nearby: 6,
  solo: 6,
  trending: 6,
  picks: 6,
  budget: 6,
} as const;

function takeUnique<T extends { id: string }>(source: T[], used: Set<string>, n: number): T[] {
  const out: T[] = [];
  for (const item of source) {
    if (used.has(item.id)) continue;
    used.add(item.id);
    out.push(item);
    if (out.length >= n) break;
  }
  return out;
}

export function buildExploreShelves<T extends ExploreShelfPlace>(
  places: T[],
  options: { moodSelected: boolean; hasLocation: boolean; budgetMax?: number | null },
): ExploreShelf<T>[] {
  const used = new Set<string>();
  const shelves: ExploreShelf<T>[] = [];

  if (options.moodSelected) {
    const moodPlaces = [...places].sort((a, b) => b.moodScore - a.moodScore || a.rankingPosition - b.rankingPosition);
    const taken = takeUnique(moodPlaces, used, SHELF_SIZE.mood);
    if (taken.length >= 1) {
      shelves.push({ id: "mood", title: "Hợp mood của bạn", layout: "grid", places: taken });
    }
  }

  if (options.hasLocation) {
    const near = [...places]
      .filter((p) => p.distanceMeters != null)
      .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
    const taken = takeUnique(near, used, SHELF_SIZE.nearby);
    if (taken.length >= 2) {
      shelves.push({ id: "nearby", title: "Gần bạn", layout: "row", places: taken });
    }
  }

  const solo = places.filter((p) => p.bestContext === "solo");
  const soloTaken = takeUnique(solo, used, SHELF_SIZE.solo);
  if (soloTaken.length >= 2) {
    shelves.push({ id: "solo", title: "Đi một mình cũng ổn", layout: "row", places: soloTaken });
  }

  const trending = [...places]
    .filter((p) => p.experienceCount > 0)
    .sort((a, b) => b.experienceCount - a.experienceCount || b.verifiedCount - a.verifiedCount);
  const trendingTaken = takeUnique(trending, used, SHELF_SIZE.trending);
  if (trendingTaken.length >= 2) {
    shelves.push({ id: "trending", title: "Đang được quan tâm", layout: "row", places: trendingTaken });
  }

  const picks = [...places]
    .filter((p) => p.isEditorialPick)
    .sort((a, b) => a.rankingPosition - b.rankingPosition);
  const picksTaken = takeUnique(picks, used, SHELF_SIZE.picks);
  if (picksTaken.length >= 2) {
    shelves.push({ id: "picks", title: "Realidi Picks", layout: "row", places: picksTaken });
  }

  const budgetCap = options.budgetMax ?? 300_000;
  const budget = places.filter(
    (p) => p.typicalSpend != null && p.typicalSpend <= budgetCap && p.spendTier !== "early_signal",
  );
  const budgetTaken = takeUnique(budget, used, SHELF_SIZE.budget);
  if (budgetTaken.length >= 2) {
    shelves.push({
      id: "budget",
      title: budgetCap === 300_000 ? "Dưới 300K" : "Phù hợp ngân sách",
      layout: "row",
      places: budgetTaken,
    });
  }

  if (shelves.length === 0 && places.length > 0) {
    shelves.push({
      id: "picks",
      title: "Gợi ý cho bạn",
      layout: "grid",
      places: places.slice(0, 8),
    });
  }

  return shelves;
}
