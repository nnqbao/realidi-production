export function isProvenNotificationDuplicate(
  a: {
    userId: string;
    type: string;
    idempotencyKey?: string | null;
    messageId?: string | null;
  },
  b: {
    userId: string;
    type: string;
    idempotencyKey?: string | null;
    messageId?: string | null;
  },
): boolean {
  if (a.userId !== b.userId || a.type !== b.type) return false;
  if (a.idempotencyKey && a.idempotencyKey === b.idempotencyKey) return true;
  if (a.type === "message" && a.messageId && a.messageId === b.messageId) return true;
  return false;
}

export function groupConsecutiveMessageNotifications<T extends {
  id: string;
  type: string;
  read_at: string | null;
  metadata?: { conversation_id?: string; count?: number } | null;
  profiles: { username?: string } | null;
}>(rows: T[]): Array<T & { groupedIds: string[]; displayCount: number }> {
  const grouped: Array<T & { groupedIds: string[]; displayCount: number }> = [];
  for (const row of rows) {
    const prev = grouped[grouped.length - 1];
    const sameBurst =
      row.type === "message" &&
      prev?.type === "message" &&
      prev.profiles?.username === row.profiles?.username &&
      Boolean(prev.metadata?.conversation_id) &&
      prev.metadata?.conversation_id === row.metadata?.conversation_id;
    if (sameBurst && prev) {
      prev.groupedIds.push(row.id);
      prev.displayCount += Number(row.metadata?.count ?? 1);
      if (!row.read_at) prev.read_at = null;
      continue;
    }
    grouped.push({
      ...row,
      groupedIds: [row.id],
      displayCount: Number(row.metadata?.count ?? 1),
    });
  }
  return grouped;
}

export function keepOldestDuplicateIds<T extends { id: string; createdAt: string }>(
  rows: T[],
  same: (a: T, b: T) => boolean,
): string[] {
  const drop = new Set<string>();
  const ordered = [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      if (same(ordered[i], ordered[j])) drop.add(ordered[j].id);
    }
  }
  return [...drop];
}
