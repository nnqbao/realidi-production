import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROUTES = [
  "/", "/admin", "/admin/audit", "/admin/categories", "/admin/collections",
  "/admin/comments", "/admin/feed", "/admin/moderation", "/admin/moods",
  "/admin/places", "/admin/places/[id]", "/admin/places/new", "/admin/posts",
  "/admin/ranking", "/admin/reports", "/admin/seed", "/admin/settings",
  "/admin/users", "/admin/verifications", "/api/events", "/api/feed",
  "/auth/callback", "/change-password", "/create", "/discover",
  "/experience/[id]", "/explore", "/home", "/login", "/map", "/me",
  "/messages", "/messages/[id]",
  "/notifications", "/onboarding", "/place/[slug]", "/post/[id]", "/privacy",
  "/profile/edit", "/reset-password", "/reset-password/update", "/saved",
  "/search", "/settings", "/signup", "/terms", "/user/[username]",
] as const;

function routeFile(route: string): string {
  const segment = route === "/" ? "" : route.slice(1);
  const grouped = [
    "create", "discover", "experience", "explore", "home", "map", "me",
    "messages", "notifications", "onboarding", "place", "post", "profile",
    "saved", "search", "settings", "user",
  ].some((prefix) => segment === prefix || segment.startsWith(`${prefix}/`));
  const base = grouped ? `app/(app)/${segment}` : `app/${segment}`;
  return `${base}/${segment.startsWith("api/") || segment === "auth/callback" ? "route.ts" : "page.tsx"}`;
}

const AUTH_ACTION_EXPORTS = [
  "checkUsernameAvailable", "signUpAction", "loginAction", "logoutAction",
  "logoutOthersAction", "logoutAllAction", "resetPasswordAction",
  "updatePasswordAction", "resendVerificationAction", "changePasswordAction",
  "getEditableProfile", "updateProfileAction", "completeOnboardingAction",
  "skipOnboardingAction",
] as const;

describe("route surface contract", () => {
  it("freezes every current page and route handler", () => {
    expect(ROUTES).toHaveLength(47);
    for (const route of ROUTES) {
      expect(existsSync(routeFile(route)), `${route} -> ${routeFile(route)}`).toBe(true);
    }
  });

  it("freezes auth server-action names during the backend cutover", () => {
    const source = readFileSync("features/auth/actions.ts", "utf8");
    for (const name of AUTH_ACTION_EXPORTS) {
      expect(source).toMatch(new RegExp(`export async function ${name}\\(`));
    }
  });
});
