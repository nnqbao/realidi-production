import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { isStaff } from "@/lib/auth/roles";
import { getDesiredMoods } from "@/features/mood/queries";
import { getSuggestedPeople, getTrendingPlaces, getUnreadNotificationCount } from "@/features/feed/queries";
import { getUnreadMessageCount } from "@/features/messages/actions";
import { isMapNavEnabled } from "@/lib/flags";
import { AppChrome } from "./app-chrome";

export async function AppShell({ children }: { children: ReactNode }) {
  const session = await getSessionUser().catch(() => null);
  const [unread, messageUnread, people, places, moods] = await Promise.all([
    getUnreadNotificationCount().catch(() => 0),
    getUnreadMessageCount().catch(() => 0),
    getSuggestedPeople(4).catch(() => []),
    getTrendingPlaces(4).catch(() => []),
    getDesiredMoods().catch(() => []),
  ]);

  return (
    <AppChrome
      session={
        session
          ? {
              user: { id: session.user.id },
              profile: {
                username: session.profile.username,
                display_name: session.profile.display_name,
                avatar_path: session.profile.avatar_path,
                show_activity_status: session.profile.show_activity_status !== false,
              },
            }
          : null
      }
      unread={unread}
      messageUnread={messageUnread}
      people={people}
      places={places}
      moods={moods}
      isStaffUser={session ? isStaff(session.profile.role) : false}
      mapEnabled={isMapNavEnabled()}
    >
      {children}
    </AppChrome>
  );
}
