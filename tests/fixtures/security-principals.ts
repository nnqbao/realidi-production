import type { UserRole } from "@/types/database";

export const SECURITY_PRINCIPALS = {
  guest: { authenticated: false, role: null },
  user: { authenticated: true, role: "user" },
  creator: { authenticated: true, role: "creator" },
  moderator: { authenticated: true, role: "moderator" },
  editor: { authenticated: true, role: "editor" },
  admin: { authenticated: true, role: "admin" },
  owner: { authenticated: true, role: "owner" },
} as const satisfies Record<
  string,
  { authenticated: boolean; role: UserRole | null }
>;

export const ADJACENT_ROLE_NEGATIVES = {
  moderate: ["user", "creator", "editor"],
  managePlaces: ["user", "creator", "moderator"],
  manageUsers: ["user", "creator", "moderator", "editor"],
  ownerOnly: ["user", "creator", "moderator", "editor", "admin"],
} as const satisfies Record<string, readonly UserRole[]>;
