import type {
  GenericDataModel, GenericMutationCtx,
} from "convex/server";
import type { GenericId } from "convex/values";

const SENSITIVE_KEY = /password|secret|token|code|credential|authorization|cookie/i;
type AuditScalar = string | number | boolean | null;

export function redactAuditValue(
  value: Record<string, AuditScalar> | undefined,
): Record<string, AuditScalar> | undefined {
  if (value === undefined) return undefined;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SENSITIVE_KEY.test(key) ? "[REDACTED]" : item,
  ]));
}

export async function appendAudit(
  ctx: GenericMutationCtx<GenericDataModel>,
  entry: {
    actor_id?: GenericId<"profiles">;
    action: string;
    target_type: string;
    target_id?: string;
    before?: Record<string, AuditScalar>;
    after?: Record<string, AuditScalar>;
    reason?: string;
    ip?: string;
    user_agent?: string;
    correlation_id?: string;
    created_at: number;
  },
): Promise<GenericId<"audit_logs">> {
  return await ctx.db.insert("audit_logs", {
    action: entry.action,
    target_type: entry.target_type,
    created_at: entry.created_at,
    ...(entry.actor_id ? { actor_id: entry.actor_id } : {}),
    ...(entry.target_id ? { target_id: entry.target_id } : {}),
    ...(entry.before ? { before: redactAuditValue(entry.before)! } : {}),
    ...(entry.after ? { after: redactAuditValue(entry.after)! } : {}),
    ...(entry.reason ? { reason: entry.reason } : {}),
    ...(entry.ip ? { ip: entry.ip } : {}),
    ...(entry.user_agent ? { user_agent: entry.user_agent } : {}),
    ...(entry.correlation_id ? { correlation_id: entry.correlation_id } : {}),
  }) as GenericId<"audit_logs">;
}
