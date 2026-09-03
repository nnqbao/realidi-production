"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { markAllNotificationsRead, markNotificationRead } from "@/features/notifications/actions";
import { messageNotificationCopy, notificationHref } from "@/features/notifications/keys";
import { groupConsecutiveMessageNotifications } from "@/features/notifications/dedupe";
import { formatCompactTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";

const copy: Record<string, string> = {
  new_follower: "đã theo dõi bạn",
  post_like: "đã thích bài viết của bạn",
  post_comment: "đã bình luận bài viết của bạn",
  comment_reply: "đã trả lời bình luận của bạn",
  post_saved: "đã lưu bài viết của bạn",
  verified_visit: "Một lần đến đã được xác minh",
  place_invite: "rủ bạn đi cùng",
  community_answer: "đã trả lời câu hỏi của bạn",
};

export type NotificationRow = {
  id: string;
  type: string;
  post_id: string | null;
  comment_id: string | null;
  read_at: string | null;
  created_at: string;
  metadata?: { conversation_id?: string; count?: number } | null;
  profiles: { username: string; display_name: string } | null;
};

export function NotificationsList({ initial }: { initial: NotificationRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [pending, start] = useTransition();

  function label(item: NotificationRow & { displayCount?: number }) {
    if (item.type === "message") {
      return messageNotificationCopy(Number(item.displayCount ?? item.metadata?.count ?? 1));
    }
    return copy[item.type] ?? item.type;
  }

  const visible = groupConsecutiveMessageNotifications(rows);

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Thông báo</h1>
        {rows.some((row) => !row.read_at) ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              const previous = rows;
              start(async () => {
                setRows((current) => current.map((row) => ({ ...row, read_at: row.read_at ?? new Date().toISOString() })));
                const result = await markAllNotificationsRead();
                if (result && "error" in result && result.error) {
                  setRows(previous);
                  toast.error("Không đánh dấu đã đọc được.");
                  return;
                }
                router.refresh();
              });
            }}
          >
            Đánh dấu tất cả đã đọc
          </Button>
        ) : null}
      </div>
      {visible.length === 0 ? (
        <EmptyState className="mt-6" title="Chưa có thông báo" description="Khi có người theo dõi hoặc tương tác với bài viết, bạn sẽ thấy ở đây." />
      ) : (
        <ul className="mt-6 space-y-2">
          {visible.map((item) => {
            const unread = !item.read_at;
            const href = notificationHref(item);
            return (
              <li key={item.id}>
                <Link
                  href={href}
                  className={cn(
                    "block rounded-[20px] border px-4 py-3 text-sm",
                    unread ? "border-brand/16 bg-brand/6" : "border-subtle bg-surface",
                  )}
                  onClick={() => {
                    if (!unread) return;
                    const previous = rows;
                    const ids = item.groupedIds;
                    start(async () => {
                      setRows((current) =>
                        current.map((row) =>
                          ids.includes(row.id) ? { ...row, read_at: row.read_at ?? new Date().toISOString() } : row,
                        ),
                      );
                      for (const id of ids) {
                        const result = await markNotificationRead(id);
                        if (result && "error" in result && result.error) {
                          setRows(previous);
                          toast.error("Không cập nhật được thông báo.");
                          return;
                        }
                      }
                      router.refresh();
                    });
                  }}
                >
                  <p>
                    {item.profiles ? <strong>{item.profiles.display_name}</strong> : null} {label(item)}
                    {unread ? (
                      <span className="ml-2 inline-block size-2 rounded-full bg-brand align-middle" aria-label="Chưa đọc" />
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatCompactTime(item.created_at)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
