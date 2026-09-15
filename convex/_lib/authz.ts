import { getAuthUserId } from "@convex-dev/auth/server";
import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import type { GenericId } from "convex/values";
import type { DataModel, Doc } from "../_generated/dataModel";
import type { UserRole } from "../validators";
import { hasCapability } from "./capabilities";
import { invariant } from "./errors";
import { isSuspended } from "./time";

type AuthzCtx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;

export type AuthorizedProfile = Pick<
  Doc<"profiles">,
  | "_id"
  | "auth_user_id"
  | "username"
  | "display_name"
  | "bio"
  | "role"
  | "created_at"
  | "deleted_at"
  | "banned_at"
  | "suspended_at"
  | "suspension_ends_at"
  | "must_change_password"
>;

export type AuthorizedIdentity = {
  authUserId: GenericId<"users">;
  profile: AuthorizedProfile;
};

export async function optionalIdentity(ctx: AuthzCtx): Promise<AuthorizedIdentity | null> {
  const authUserId = await getAuthUserId(ctx);
  if (authUserId === null) return null;
  const profile = await ctx.db.query("profiles")
    .withIndex("by_auth_user", (query) => query.eq("auth_user_id", authUserId))
    .unique() as AuthorizedProfile | null;
  return profile === null ? null : { authUserId, profile };
}

export async function requireIdentity(ctx: AuthzCtx): Promise<AuthorizedIdentity> {
  const identity = await optionalIdentity(ctx);
  invariant(identity !== null, "UNAUTHENTICATED", "Authentication required");
  return identity;
}

export async function requireActiveProfile(
  ctx: AuthzCtx,
  now = Date.now(),
): Promise<AuthorizedIdentity> {
  const identity = await requireIdentity(ctx);
  const { profile } = identity;
  invariant(
    profile.deleted_at === undefined &&
      profile.banned_at === undefined &&
      !isSuspended(now, profile.suspended_at, profile.suspension_ends_at),
    "ACCOUNT_INACTIVE",
    "Account is not active",
  );
  return identity;
}

export async function requireVerifiedProfile(
  ctx: AuthzCtx,
  now = Date.now(),
): Promise<AuthorizedIdentity> {
  const identity = await requireActiveProfile(ctx, now);
  const user = await ctx.db.get(identity.authUserId) as { emailVerificationTime?: number } | null;
  invariant(user?.emailVerificationTime !== undefined, "EMAIL_UNVERIFIED", "Email verification required");
  invariant(
    identity.profile.must_change_password !== true,
    "MUST_CHANGE_PASSWORD",
    "Password change required",
  );
  return identity;
}

async function requireRole(
  ctx: AuthzCtx,
  predicate: (role: UserRole) => boolean,
  now?: number,
): Promise<AuthorizedIdentity> {
  const identity = await requireVerifiedProfile(ctx, now);
  invariant(predicate(identity.profile.role), "FORBIDDEN", "Insufficient capability");
  return identity;
}

export const requireOwner = (ctx: AuthzCtx, now?: number) =>
  requireRole(ctx, (role) => role === "owner", now);

export const requireAdmin = (ctx: AuthzCtx, now?: number) =>
  requireRole(ctx, (role) => hasCapability(role, "manageUsers"), now);

export const requireModerator = (ctx: AuthzCtx, now?: number) =>
  requireRole(ctx, (role) => hasCapability(role, "moderate"), now);

export const requirePlaceManager = (ctx: AuthzCtx, now?: number) =>
  requireRole(ctx, (role) => hasCapability(role, "managePlaces"), now);

export const requireStaff = (ctx: AuthzCtx, now?: number) =>
  requireRole(
    ctx,
    (role) =>
      role === "moderator" || role === "editor" || role === "admin" || role === "owner",
    now,
  );

export async function requireConversationMember(
  ctx: AuthzCtx,
  conversationId: GenericId<"conversations">,
  now?: number,
): Promise<AuthorizedIdentity> {
  const identity = await requireVerifiedProfile(ctx, now);
  const membership = await ctx.db.query("conversation_participants")
    .withIndex("by_pair", (query) =>
      query.eq("pair_key", `${conversationId}:${identity.profile._id}`))
    .unique();
  invariant(membership !== null, "FORBIDDEN", "Conversation membership required");
  return identity;
}

export function requireResourceOwner(
  identity: AuthorizedIdentity,
  ownerId: GenericId<"profiles">,
): void {
  invariant(identity.profile._id === ownerId, "FORBIDDEN", "Resource ownership required");
}

export function canViewPost(args: {
  isAuthor: boolean;
  isModerator: boolean;
  isFollower: boolean;
  isBlocked: boolean;
  status: "draft" | "published" | "hidden" | "deleted";
  visibility: "public" | "followers" | "private";
  moderationStatus: "pending" | "approved" | "hidden" | "rejected";
  deleted: boolean;
}): boolean {
  if (args.isModerator || args.isAuthor) return true;
  if (args.isBlocked || args.deleted || args.status !== "published" ||
      args.moderationStatus === "hidden" || args.moderationStatus === "rejected") return false;
  if (args.visibility === "public") return true;
  return args.visibility === "followers" && args.isFollower;
}
