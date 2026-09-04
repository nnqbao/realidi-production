import { expect, test, type Page } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:8026";

async function latestCode(email: string, subject: string): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const response = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email} subject:"${subject}"`)}`,
    );
    const body = (await response.json()) as {
      messages?: { Snippet?: string }[];
    };
    const code = body.messages?.[0]?.Snippet?.match(/\b\d{8}\b/)?.[0];
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`No Mailpit code for ${email} (${subject})`);
}

async function fillPassword(page: Page, id: string, value: string) {
  await page.locator(`#${id}`).fill(value);
}

test("sign up, verify, reset, and sign back in against local Convex", async ({ page }) => {
  test.setTimeout(90_000);
  const stamp = Date.now();
  const email = `e2e-${stamp}@example.test`;
  const username = `e2e_${stamp}`.slice(0, 30);
  const password = "correct-horse-1";
  const nextPassword = "brand-new-pass-2";

  await page.goto("/signup");
  await page.getByLabel("Họ tên").fill("E2E Porter");
  await page.getByLabel("Tên người dùng").fill(username);
  await page.getByLabel("Email").fill(email);
  await fillPassword(page, "password", password);
  await fillPassword(page, "confirmPassword", password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(page.getByRole("heading", { name: /mã xác minh/i })).toBeVisible();

  await page.getByLabel("Mã xác minh").fill(await latestCode(email, "Xác minh email Realidi"));
  await page.getByRole("button", { name: "Xác minh email" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: /vài câu hỏi/i })).toBeVisible();

  await page.getByRole("button", { name: /bỏ qua/i }).click();
  await page.goto("/settings");
  await expect(page.locator("#main").getByText(email).first()).toBeVisible();
  await expect(page.locator("#main").getByText("Đã xác minh").first()).toBeVisible();

  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/(home|explore|login)/);
  await page.goto("/reset-password");
  await expect(page).toHaveURL(/\/reset-password/);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: /gửi/i }).click();
  await expect(page).toHaveURL(/\/reset-password\/update/);

  await page.getByLabel("Mã đặt lại").fill(await latestCode(email, "Đặt lại mật khẩu Realidi"));
  await fillPassword(page, "password", nextPassword);
  await fillPassword(page, "confirmPassword", nextPassword);
  await page.getByRole("button", { name: "Cập nhật mật khẩu" }).click();
  await expect(page).toHaveURL(/\/settings/);

  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/(home|explore|login)/);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await fillPassword(page, "password", nextPassword);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto("/me");
  await expect(page).toHaveURL(new RegExp(`/user/${username}`));
  await expect(page.getByRole("heading", { name: "E2E Porter" })).toBeVisible();
});
