export const PROFILE_USERNAME_FIELD = "profile_handle";

export type ProfileEditDraft = {
  displayName: string;
  username: string;
  bio: string;
};

export type ProfileEditStatus = "loading" | "ready" | "submitting" | "success" | "error";

export function isProfileEditReady(draft: ProfileEditDraft | null): draft is ProfileEditDraft {
  return Boolean(draft && draft.username.trim().length > 0 && draft.displayName.trim().length > 0);
}

export function usernameFieldMustNotBeLoginUsername(name: string): boolean {
  return name !== "username" && name !== "email" && name !== "user";
}
