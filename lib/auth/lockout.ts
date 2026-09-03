import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail } from "./account";

const FAIL_LIMIT = 8;
const LOCK_MS = 15 * 60_000;

export async function getLockout(email: string): Promise<{ locked: boolean; retryAt: string | null }> {
  try {
    const admin = createAdminClient();
    const key = normalizeEmail(email);
    const { data } = await admin.from("auth_lockouts").select("failed_count, locked_until").eq("email_normalized", key).maybeSingle();
    if (!data?.locked_until) return { locked: false, retryAt: null };
    if (new Date(data.locked_until).getTime() > Date.now()) {
      return { locked: true, retryAt: data.locked_until };
    }
    return { locked: false, retryAt: null };
  } catch {
    return { locked: false, retryAt: null };
  }
}

export async function recordLoginFailure(email: string): Promise<{ locked: boolean }> {
  try {
    const admin = createAdminClient();
    const key = normalizeEmail(email);
    const { data } = await admin.from("auth_lockouts").select("failed_count, locked_until").eq("email_normalized", key).maybeSingle();
    const failed = (data?.failed_count ?? 0) + 1;
    const lockedUntil = failed >= FAIL_LIMIT ? new Date(Date.now() + LOCK_MS).toISOString() : null;
    await admin.from("auth_lockouts").upsert({
      email_normalized: key,
      failed_count: failed,
      locked_until: lockedUntil,
      updated_at: new Date().toISOString(),
    });
    return { locked: Boolean(lockedUntil) };
  } catch {
    return { locked: false };
  }
}

export async function clearLoginFailures(email: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("auth_lockouts").delete().eq("email_normalized", normalizeEmail(email));
  } catch {
    /* lockout table may not exist yet */
  }
}
