import { expect, test } from "@playwright/test";

const MOCK_STORY =
  "It began with a violinist in Buenos Aires.\n\nThe city hummed with neon and rain.";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/generate-stories", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ output: MOCK_STORY }),
    });
  });

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("generate a story and see output, stats, and history", async ({ page }) => {
  await page.locator("#seed").fill("A violinist in Buenos Aires");
  await page.locator("#tone").fill("romantic cyberpunk");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.locator("#output pre")).toContainText("violinist in Buenos Aires", {
    timeout: 15_000,
  });
  await expect(page.locator("#stats")).toContainText("Words:");
  await expect(page.getByRole("button", { name: "Copy story" })).toBeVisible();
  await expect(page.locator("#history li").first()).toContainText("violinist");
});
