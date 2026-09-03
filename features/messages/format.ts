import { GROUP_GAP_MS, type ChatMessage } from "./types";
import { presenceCopy, resolvePresence } from "@/features/presence/format";

export function lastMessagePreview(kind?: string | null, body?: string | null, deleted?: boolean) {
  if (deleted) return "Tin nhắn đã được thu hồi.";
  if (kind === "place") return "Đã chia sẻ một địa điểm";
  if (kind === "post") return "Đã chia sẻ một bài viết";
  if (kind === "profile") return "Đã chia sẻ một hồ sơ";
  if (kind === "invite") return "Lời mời đi cùng";
  if (kind === "image") return "Đã gửi một ảnh";
  if (kind === "system") return "Cập nhật cuộc trò chuyện";
  return body?.trim() || "Tin nhắn mới";
}

export function messageTimeLabel(iso: string, now = new Date()) {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startMsg = new Date(date);
  startMsg.setHours(0, 0, 0, 0);
  const diffDays = Math.round((startToday.getTime() - startMsg.getTime()) / 86_400_000);
  if (diffDays === 0) return time;
  if (diffDays === 1) return `Hôm qua · ${time}`;
  return `${date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} · ${time}`;
}

export function dateSeparatorLabel(iso: string, now = new Date()) {
  const date = new Date(iso);
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startMsg = new Date(date);
  startMsg.setHours(0, 0, 0, 0);
  const diffDays = Math.round((startToday.getTime() - startMsg.getTime()) / 86_400_000);
  if (diffDays === 0) return "Hôm nay";
  if (diffDays === 1) return "Hôm qua";
  if (diffDays < 7) return date.toLocaleDateString("vi-VN", { weekday: "long" });
  return date.toLocaleDateString("vi-VN", { day: "numeric", month: "long" });
}

export function sameDay(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export type TimelineItem =
  | { type: "sep"; key: string; label: string }
  | { type: "msg"; key: string; message: ChatMessage; grouped: boolean; showAvatar: boolean };

export function buildTimeline(messages: ChatMessage[], now = new Date()): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const prev = messages[i - 1];
    if (!prev || !sameDay(prev.created_at, msg.created_at)) {
      items.push({ type: "sep", key: `sep-${msg.created_at}`, label: dateSeparatorLabel(msg.created_at, now) });
    }
    const grouped = Boolean(
      prev &&
        prev.sender_id === msg.sender_id &&
        !prev.deleted_at &&
        !msg.deleted_at &&
        sameDay(prev.created_at, msg.created_at) &&
        new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() <= GROUP_GAP_MS,
    );
    items.push({
      type: "msg",
      key: msg.id,
      message: msg,
      grouped,
      showAvatar: !grouped,
    });
  }
  return items;
}

export function inviteWhenLabel(date?: string | null, time?: string | null) {
  const parts: string[] = [];
  if (date) {
    const iso = date.includes("T") ? date : `${date}T12:00:00`;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) {
      parts.push(parsed.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "numeric" }));
    }
  }
  if (time) parts.push(time);
  return parts.join(" · ");
}

export function presenceLabel(input: { online?: boolean; lastSeenAt?: string | null; idle?: boolean; showActivity?: boolean }, now = new Date()) {
  const snap = resolvePresence({
    connected: Boolean(input.online),
    lastTrackAt: input.online ? (input.idle ? now.getTime() - 6 * 60_000 : now.getTime()) : null,
    idle: input.idle,
    lastActiveAt: input.lastSeenAt,
    showActivity: input.showActivity,
    now,
  });
  return { label: presenceCopy(snap.status, snap.lastActiveAt, now), online: snap.status === "online", status: snap.status };
}
