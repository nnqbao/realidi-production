import { expect, type Page } from "@playwright/test";

export type E2ERole = "user" | "moderator" | "editor" | "admin" | "owner";

const ROLE_ENV: Record<E2ERole, { email: string; password: string }> = {
  user: { email: "E2E_USER_EMAIL", password: "E2E_USER_PASSWORD" },
  moderator: { email: "E2E_MODERATOR_EMAIL", password: "E2E_MODERATOR_PASSWORD" },
  editor: { email: "E2E_EDITOR_EMAIL", password: "E2E_EDITOR_PASSWORD" },
  admin: { email: "E2E_ADMIN_EMAIL", password: "E2E_ADMIN_PASSWORD" },
  owner: { email: "E2E_OWNER_EMAIL", password: "E2E_OWNER_PASSWORD" },
};

export function e2eCredentials(role: E2ERole): { email: string; password: string } | null {
  const email = process.env[ROLE_ENV[role].email];
  const password = process.env[ROLE_ENV[role].password];
  if (!email || !password) return null;
  return { email, password };
}

export function missingRoleMessage(role: E2ERole): string {
  const { email, password } = ROLE_ENV[role];
  return `Set ${email} / ${password} in ignored .env.local to run this ${role} flow.`;
}

export async function signInAs(page: Page, role: E2ERole): Promise<void> {
  const creds = e2eCredentials(role);
  if (!creds) throw new Error(missingRoleMessage(role));
  await page.goto("/login");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Mật khẩu").fill(creds.password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).not.toHaveURL(/\/login(\?|$)/);
}
