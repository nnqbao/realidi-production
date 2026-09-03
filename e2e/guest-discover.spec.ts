import { test, expect } from "@playwright/test";

test("guest can open home feed", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByText("Dành cho bạn")).toBeVisible();
});

test("guest can open explore", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.locator("h1")).toBeVisible();
});

test("guest can open login from the app", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /chào mừng|welcome/i })).toBeVisible();
});
