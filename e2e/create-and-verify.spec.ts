import { test, expect } from "@playwright/test";

test.describe("create experience", () => {
  test.skip(!process.env.E2E_USER_EMAIL, "Requires E2E credentials.");

  test("create flow is reachable after login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(process.env.E2E_USER_EMAIL!);
    await page.getByLabel("Mật khẩu").fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await page.goto("/create");
    await expect(page.getByRole("heading", { name: "Chia sẻ trải nghiệm" })).toBeVisible();
  });
});
