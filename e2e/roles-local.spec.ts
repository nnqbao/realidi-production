import { expect, test } from "@playwright/test";
import { e2eCredentials, missingRoleMessage, signInAs } from "./helpers/roles";

test("guest can open home without a session", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByText("Dành cho bạn")).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng nhập" })).toBeVisible();
});

test("guest is sent to login from /admin", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
});

for (const role of ["user", "moderator", "editor"] as const) {
  test.describe(`${role} smoke`, () => {
    test.skip(!e2eCredentials(role), missingRoleMessage(role));

    test(`can sign in as ${role}`, async ({ page }) => {
      await signInAs(page, role);
      await page.goto("/home");
      await expect(page.getByText("Dành cho bạn")).toBeVisible();
    });
  });
}

test.describe("admin smoke", () => {
  test.skip(!e2eCredentials("admin"), missingRoleMessage("admin"));

  test("can open reports", async ({ page }) => {
    await signInAs(page, "admin");
    await page.goto("/admin/reports");
    await expect(page.getByRole("heading", { name: "Báo cáo" })).toBeVisible();
  });
});

test.describe("owner smoke", () => {
  test.skip(!e2eCredentials("owner"), missingRoleMessage("owner"));

  test("can open the admin dashboard", async ({ page }) => {
    await signInAs(page, "owner");
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Tổng quan" })).toBeVisible();
  });
});
