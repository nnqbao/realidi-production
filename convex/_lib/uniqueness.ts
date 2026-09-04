import type { GenericDatabaseReader, GenericDataModel } from "convex/server";
import { invariant } from "./errors";

export function pairKey(left: string, right: string): string {
  return `${left}:${right}`;
}

export function unorderedPairKey(left: string, right: string): string {
  return [left, right].sort().join(":");
}

export async function assertUniqueByIndex(
  db: GenericDatabaseReader<GenericDataModel>,
  table: string,
  index: string,
  field: string,
  value: string,
  message: string,
): Promise<void> {
  const existing = await db.query(table)
    .withIndex(index, (query) => query.eq(field, value))
    .first();
  invariant(existing === null, "CONFLICT", message);
}
