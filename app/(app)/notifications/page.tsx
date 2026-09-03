import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { getNotifications } from "@/features/feed/queries";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { NotificationsList, type NotificationRow } from "@/features/notifications/list";

export default async function NotificationsPage() {
  const session = await getSessionUser().catch(() => null);
  if (!session) {
    return (
      <EmptyState
        title="Đăng nhập để xem thông báo"
        action={
          <Button asChild>
            <Link href="/login?next=/notifications">Đăng nhập</Link>
          </Button>
        }
      />
    );
  }
  const rows = (await getNotifications()) as NotificationRow[];

  return <NotificationsList initial={rows} />;
}
