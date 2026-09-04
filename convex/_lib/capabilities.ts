import type { UserRole } from "../validators";

export const CAPABILITIES = {
  moderate: ["moderator", "admin", "owner"],
  managePlaces: ["editor", "admin", "owner"],
  manageUsers: ["admin", "owner"],
  manageRanking: ["admin", "owner"],
  readAudit: ["admin", "owner"],
  assignPrivilegedRoles: ["owner"],
} as const satisfies Record<string, readonly UserRole[]>;

export type Capability = keyof typeof CAPABILITIES;

export function hasCapability(role: UserRole, capability: Capability): boolean {
  return (CAPABILITIES[capability] as readonly UserRole[]).includes(role);
}

export const canModerate = (role: UserRole) => hasCapability(role, "moderate");
export const canManagePlaces = (role: UserRole) => hasCapability(role, "managePlaces");
export const canManageUsers = (role: UserRole) => hasCapability(role, "manageUsers");
export const canManageRanking = (role: UserRole) => hasCapability(role, "manageRanking");
export const canReadAudit = (role: UserRole) => hasCapability(role, "readAudit");

export function canAssignRole(actor: UserRole, target: UserRole): boolean {
  if (target === "owner" || target === "admin") return actor === "owner";
  return actor === "owner" || actor === "admin";
}
