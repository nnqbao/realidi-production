import type { UserRole } from "@/types/database";

export type { UserRole };

export const STAFF_ROLES: UserRole[] = ["moderator", "editor", "admin", "owner"];

export function isStaff(role: UserRole | null | undefined): boolean {
  return role === "moderator" || role === "editor" || role === "admin" || role === "owner";
}

export function isAdmin(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "owner";
}

export function isOwner(role: UserRole | null | undefined): boolean {
  return role === "owner";
}

export function canModerate(role: UserRole | null | undefined): boolean {
  return role === "moderator" || role === "admin" || role === "owner";
}

export function canManagePlaces(role: UserRole | null | undefined): boolean {
  return role === "editor" || role === "admin" || role === "owner";
}

export function canManageUsers(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "owner";
}

export function canAssignRoles(actor: UserRole | null | undefined, next: UserRole): boolean {
  if (actor === "owner") return true;
  if (actor === "admin") return next !== "owner" && next !== "admin";
  return false;
}

export function assertStaff(role: UserRole | null | undefined): asserts role is "moderator" | "editor" | "admin" | "owner" {
  if (!isStaff(role)) {
    throw new Error("FORBIDDEN_STAFF");
  }
}

export function assertAdmin(role: UserRole | null | undefined): asserts role is "admin" | "owner" {
  if (!isAdmin(role)) {
    throw new Error("FORBIDDEN_ADMIN");
  }
}

export function assertOwner(role: UserRole | null | undefined): asserts role is "owner" {
  if (!isOwner(role)) {
    throw new Error("FORBIDDEN_OWNER");
  }
}

export function assertCanModerate(role: UserRole | null | undefined): void {
  if (!canModerate(role)) throw new Error("FORBIDDEN_MODERATE");
}

export function assertCanManagePlaces(role: UserRole | null | undefined): void {
  if (!canManagePlaces(role)) throw new Error("FORBIDDEN_PLACES");
}
