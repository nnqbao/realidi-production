import { test, expect } from "@playwright/test";

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.describe("authenticated intent loop", () => {
  test.skip(!email || !password, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this flow.");

  test("login, select mood, open place, save", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Mật khẩu").fill(password!);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await page.waitForURL(/home/);
    await page.goto("/explore");
    const mood = page.getByRole("button").nth(0);
    await mood.click();
    const firstPlace = page.locator("article a").first();
    await expect(firstPlace).toBeVisible();
    await firstPlace.click();
    await page.getByRole("button", { name: /Lưu/ }).first().click();
  });
});
