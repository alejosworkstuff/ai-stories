import { expect, test } from "@playwright/test";

const SEED = "A detective in Paris";

const INTRO_PREFIXES = [
  "It began with",
  "Everything started when",
  "No one expected that",
  "The story truly begins when",
];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/generate-stories", async (route) => {
    await route.fulfill({
      status: 402,
      contentType: "application/json",
      body: JSON.stringify({ error: "replicate_no_credits" }),
    });
  });

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("402 from API shows fallback modal and local story", async ({ page }) => {
  await page.locator("#seed").fill(SEED);
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.locator(".fallback-modal p")).toContainText(
    "Out of credits - generating fallback story",
    { timeout: 15_000 }
  );
  await page.getByRole("button", { name: "OK" }).click();
  await expect(page.locator(".fallback-overlay")).toHaveCount(0);

  const output = await page.locator("#output pre").textContent();
  expect(output).toContain(SEED);
  expect(INTRO_PREFIXES.some((prefix) => output.startsWith(prefix))).toBe(true);

  await expect(page.locator("#stats")).toContainText("Words:");
  await expect(page.getByRole("button", { name: "Copy story" })).toBeVisible();
  await expect(page.locator("#history li").first()).toContainText("detective");
  await expect(page.locator("#continueBtn")).toBeEnabled();
});
