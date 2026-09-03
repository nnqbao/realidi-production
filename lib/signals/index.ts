import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";

export type InterestEntityType = "place" | "mood" | "author" | "post" | "category" | "area";

const WEIGHTS: Record<string, number> = {
  post_impression: 0.2,
  post_opened: 0.8,
  post_liked: 1.5,
  post_saved: 2.2,
  post_shared: 1.8,
  post_commented: 2,
  follow_clicked: 2.5,
  profile_opened: 1,
  mood_selected: 2,
  place_opened: 1.6,
  place_saved: 2.4,
  directions_clicked: 2.6,
  been_there_clicked: 3,
  verification_succeeded: 3.2,
  share_to_message: 2,
  place_shared_to_message: 2.2,
};

export async function recordInterestSignal(input: {
  entityType: InterestEntityType;
  entityId?: string | null;
  signalType: string;
  weight?: number;
}) {
  const session = await getSessionUser().catch(() => null);
  if (!session || !input.entityId) return;
  const weight = input.weight ?? WEIGHTS[input.signalType] ?? 1;
  const supabase = await createServerSupabase();
  await supabase.from("user_interest_signals").insert({
    user_id: session.user.id,
    entity_type: input.entityType,
    entity_id: input.entityId,
    signal_type: input.signalType,
    weight,
  });
}

export async function getUserTaste(userId: string) {
  const supabase = await createServerSupabase();
  const since = new Date(Date.now() - 45 * 24 * 3600_000).toISOString();
  const { data } = await supabase
    .from("user_interest_signals")
    .select("entity_type, entity_id, weight")
    .eq("user_id", userId)
    .gte("created_at", since)
    .limit(400);
  const places = new Map<string, number>();
  const moods = new Map<string, number>();
  const authors = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.entity_id) continue;
    const target =
      row.entity_type === "place" ? places : row.entity_type === "mood" ? moods : row.entity_type === "author" ? authors : null;
    if (!target) continue;
    target.set(row.entity_id, (target.get(row.entity_id) ?? 0) + Number(row.weight));
  }
  return { places, moods, authors };
}
