import type { Profile } from "@/types/database";

export type AccountGate = "ok" | "unverified" | "suspended" | "banned" | "deleted";

export function accountGate(profile: Pick<Profile, "deleted_at" | "banned_at" | "suspended_at" | "suspension_ends_at">, emailConfirmed: boolean): AccountGate {
  if (profile.deleted_at) return "deleted";
  if (profile.banned_at) return "banned";
  if (profile.suspended_at) {
    if (profile.suspension_ends_at && new Date(profile.suspension_ends_at).getTime() <= Date.now()) {
      return "ok";
    }
    return "suspended";
  }
  if (!emailConfirmed) return "unverified";
  return "ok";
}

export function gateMessage(gate: AccountGate): string | null {
  switch (gate) {
    case "deleted":
      return "Tài khoản này không còn khả dụng.";
    case "banned":
      return "Tài khoản đã bị khóa vĩnh viễn.";
    case "suspended":
      return "Tài khoản đang bị tạm khóa. Liên hệ hỗ trợ nếu bạn nghĩ đây là nhầm lẫn.";
    default:
      return null;
  }
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
