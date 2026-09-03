import { describe, expect, it } from "vitest";
import { profileUpdateSchema, usernameSchema, normalizeUsername } from "@/lib/validation";
import {
  PROFILE_USERNAME_FIELD,
  isProfileEditReady,
  usernameFieldMustNotBeLoginUsername,
} from "@/features/profile/edit-state";

describe("profile edit username field", () => {
  it("does not use the login username input name that browsers autofill", () => {
    expect(PROFILE_USERNAME_FIELD).toBe("profile_handle");
    expect(usernameFieldMustNotBeLoginUsername(PROFILE_USERNAME_FIELD)).toBe(true);
    expect(usernameFieldMustNotBeLoginUsername("username")).toBe(false);
  });

  it("stays in loading until both display name and username are present", () => {
    expect(isProfileEditReady(null)).toBe(false);
    expect(isProfileEditReady({ displayName: "Linh Trần", username: "", bio: "" })).toBe(false);
    expect(isProfileEditReady({ displayName: "Linh Trần", username: "linhsaigon", bio: "Saigon" })).toBe(true);
  });

  it("rejects empty or whitespace usernames before any update call", () => {
    expect(normalizeUsername("")).toBe("");
    expect(usernameSchema.safeParse("").success).toBe(false);
    expect(
      profileUpdateSchema.safeParse({ displayName: "Linh Trần", username: "", bio: "ok" }).success,
    ).toBe(false);
  });

  it("allows keeping the current username", () => {
    expect(usernameSchema.safeParse("linhsaigon").success).toBe(true);
    expect(
      profileUpdateSchema.safeParse({
        displayName: "Linh Trần",
        username: "linhsaigon",
        bio: "Coffee in Saigon",
      }).success,
    ).toBe(true);
  });
});
