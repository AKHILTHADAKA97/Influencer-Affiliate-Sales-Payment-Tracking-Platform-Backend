import { expect, test } from "@playwright/test";

test("login page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
  await expect(page.getByPlaceholder("Email")).toBeVisible();
  await expect(page.getByPlaceholder("Password")).toBeVisible();
});

test("admin can login and see dashboard shell", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Email").fill("admin1@influencerai.com");
  await page.getByPlaceholder("Password").fill("Admin@123");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByText("Influencer AI Platform")).toBeVisible();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
});
