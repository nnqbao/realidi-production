import { test, expect } from "@playwright/test";

test.describe("messages local", () => {
  test("guest is asked to sign in", async ({ page }) => {
    await page.goto("/messages");
    await expect(page.getByText("Đăng nhập để nhắn tin")).toBeVisible();
  });

  test.describe("signed-in inbox", () => {
    test.skip(!process.env.E2E_USER_EMAIL, "Requires E2E credentials.");

    test("inbox heading is reachable after login", async ({ page }) => {
      await page.goto("/login");
      await page.getByLabel("Email").fill(process.env.E2E_USER_EMAIL!);
      await page.getByLabel("Mật khẩu").fill(process.env.E2E_USER_PASSWORD!);
      await page.getByRole("button", { name: "Đăng nhập" }).click();
      await page.goto("/messages");
      await expect(page.getByRole("heading", { name: "Tin nhắn" })).toBeVisible();
    });
  });
});
