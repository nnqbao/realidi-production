import { test, expect } from "@playwright/test";

test.describe("admin moderation", () => {
  test.skip(!process.env.E2E_ADMIN_EMAIL, "Requires E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD.");

  test("admin can open reports", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByLabel("Mật khẩu").fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await page.goto("/admin/reports");
    await expect(page.getByRole("heading", { name: "Báo cáo" })).toBeVisible();
  });
});
