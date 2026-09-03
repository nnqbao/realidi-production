import { headers } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export async function writeAuditLog(input: {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
}) {
  const headerList = await headers().catch(() => null);
  const ip = headerList?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerList?.get("x-real-ip") ?? null;
  const userAgent = headerList?.get("user-agent") ?? null;
  const row = {
    actor_id: input.actorId,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    before: (input.before ?? null) as Json | null,
    after: (input.after ?? null) as Json | null,
    reason: input.reason ?? null,
    ip,
    user_agent: userAgent,
  };
  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.from("audit_logs").insert(row);
    if (!error) return;
  } catch {
    /* fall through to service role */
  }
  try {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert(row);
  } catch {
    /* audit table may not exist yet during rollout */
  }
}
