import { api } from "@/convex/_generated/api";
import { convexMutation, convexQueryAuthed } from "@/lib/convex/server";
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

function entityProperty(
  entityType: InterestEntityType,
  entityId: string,
): Record<string, string | number | boolean | null> {
  switch (entityType) {
    case "place":
      return { place_id: entityId };
    case "mood":
      return { mood_id: entityId };
    case "author":
      return { target_user_id: entityId };
    case "post":
      return { post_id: entityId };
    default:
      return { entity_id: entityId };
  }
}

export async function recordInterestSignal(input: {
  entityType: InterestEntityType;
  entityId?: string | null;
  signalType: string;
  weight?: number;
}) {
  const session = await getSessionUser().catch(() => null);
  if (!session || !input.entityId) return;
  const weight = input.weight ?? WEIGHTS[input.signalType] ?? 1;
  await convexMutation(api.analytics.recordEvent, {
    eventName: input.signalType,
    properties: { ...entityProperty(input.entityType, input.entityId), weight },
  });
}

export async function getUserTaste(userId?: string) {
  void userId;
  const session = await getSessionUser().catch(() => null);
  if (!session) return { places: new Map<string, number>(), moods: new Map<string, number>(), authors: new Map<string, number>() };
  const taste = await convexQueryAuthed(api.analytics.taste, {});
  return {
    places: new Map(Object.entries(taste.places)),
    moods: new Map(Object.entries(taste.moods)),
    authors: new Map(Object.entries(taste.authors)),
  };
}
