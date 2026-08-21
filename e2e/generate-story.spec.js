import { expect, test } from "@playwright/test";

const MOCK_STORY =
  "It began with a violinist in Buenos Aires.\n\nThe city hummed with neon and rain.";

const MOCK_DETECTIVE_STORY =
  "The detective could hear every lie in the room.\n\nNobody spoke freely around her.";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/generate-stories", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ output: MOCK_STORY }),
    });
  });

  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
});

test("blocks create without a genre and shows alert pill", async ({ page }) => {
  await page.locator("#seed").fill("A violinist in Buenos Aires");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.locator(".alert-pill")).toContainText("Add a genre to create a story.");
  await expect(page.locator("#history li")).toHaveCount(0);
  await expect(page.locator("#output pre")).toHaveCount(0);

  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.locator(".alert-pill")).toHaveClass(/is-shaking/);
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
  await expect(page.locator("#continueBtn")).toBeEnabled();
});

test("session memory restores conversation after reload", async ({ page }) => {
  await page.locator("#seed").fill("A violinist in Buenos Aires");
  await page.locator("#tone").fill("romantic cyberpunk");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.locator("#output pre")).toContainText("violinist in Buenos Aires", {
    timeout: 15_000,
  });
  await expect(page.locator("#continueBtn")).toBeEnabled();
  await expect(page.locator("#history li")).toHaveCount(1);

  await page.reload();

  await expect(page.locator("#tone")).toHaveValue("romantic cyberpunk");
  await expect(page.locator("#output pre")).toContainText("violinist in Buenos Aires");
  await expect(page.locator("#continueBtn")).toBeEnabled();
});

test("delete one history item and clear all", async ({ page }) => {
  let requestCount = 0;
  await page.unroute("**/api/generate-stories");
  await page.route("**/api/generate-stories", async (route) => {
    requestCount += 1;
    const output = requestCount === 1 ? MOCK_STORY : MOCK_DETECTIVE_STORY;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ output }),
    });
  });

  await page.locator("#seed").fill("A violinist in Buenos Aires");
  await page.locator("#tone").fill("romantic cyberpunk");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.locator("#history li")).toHaveCount(1);

  await page.locator("#seed").fill("A detective who can hear lies");
  await page.locator("#tone").fill("noir");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.locator("#history li")).toHaveCount(2);

  // History is newest-first; delete the older (second) row and keep the latest story.
  await page.getByRole("button", { name: "Delete story" }).nth(1).click();
  await expect(page.locator("#history li")).toHaveCount(1);
  await expect(page.locator("#history li").first()).toContainText("detective");

  await page.getByRole("button", { name: "History options" }).click();
  await page.getByRole("menuitem", { name: "Delete…" }).click();
  await expect(page.getByRole("dialog")).toContainText("clear story history");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator("#history li")).toHaveCount(1);

  await page.getByRole("button", { name: "History options" }).click();
  await page.getByRole("menuitem", { name: "Delete…" }).click();
  await page.getByRole("button", { name: "Delete all" }).click();
  await expect(page.locator("#history li")).toHaveCount(0);
});

test("favorite pins a story and filter shows only favorites", async ({ page }) => {
  let requestCount = 0;
  await page.unroute("**/api/generate-stories");
  await page.route("**/api/generate-stories", async (route) => {
    requestCount += 1;
    const output = requestCount === 1 ? MOCK_STORY : MOCK_DETECTIVE_STORY;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ output }),
    });
  });

  await page.locator("#seed").fill("A violinist in Buenos Aires");
  await page.locator("#tone").fill("romantic cyberpunk");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.locator("#history li")).toHaveCount(1);

  await page.locator("#seed").fill("A detective who can hear lies");
  await page.locator("#tone").fill("noir");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.locator("#history li")).toHaveCount(2);
  await expect(page.locator("#history li").first()).toContainText("detective");

  await page.getByRole("button", { name: "Favorite story" }).nth(1).click();
  await expect(page.locator("#history li").first()).toContainText("violinist");
  await expect(
    page.locator("#history li").first().getByRole("button", { name: "Unfavorite story" })
  ).toBeVisible();

  await page.getByRole("button", { name: "History options" }).click();
  await page.getByRole("menuitem", { name: "Show only favorites" }).click();
  await expect(page.locator("#history li")).toHaveCount(1);
  await expect(page.locator("#history li").first()).toContainText("violinist");

  await page.getByRole("button", { name: "History options" }).click();
  await page.getByRole("menuitem", { name: "Show all stories" }).click();
  await expect(page.locator("#history li")).toHaveCount(2);
});

test("delete only unfavourite stories keeps favorites", async ({ page }) => {
  let requestCount = 0;
  await page.unroute("**/api/generate-stories");
  await page.route("**/api/generate-stories", async (route) => {
    requestCount += 1;
    const output = requestCount === 1 ? MOCK_STORY : MOCK_DETECTIVE_STORY;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ output }),
    });
  });

  await page.locator("#seed").fill("A violinist in Buenos Aires");
  await page.locator("#tone").fill("romantic cyberpunk");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.locator("#history li")).toHaveCount(1);

  await page.locator("#seed").fill("A detective who can hear lies");
  await page.locator("#tone").fill("noir");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.locator("#history li")).toHaveCount(2);

  await page.getByRole("button", { name: "Favorite story" }).nth(1).click();
  await expect(page.locator("#history li").first()).toContainText("violinist");

  await page.getByRole("button", { name: "History options" }).click();
  await page.getByRole("menuitem", { name: "Delete…" }).click();
  await page.getByRole("button", { name: "Delete only unfavourite stories" }).click();
  await expect(page.locator("#history li")).toHaveCount(1);
  await expect(page.locator("#history li").first()).toContainText("violinist");
});

test("continue a story appends the next part", async ({ page }) => {
  const continuation =
    "The violinist followed the melody into a hidden alley.\n\nNeon reflected off wet cobblestones.";

  let requestCount = 0;
  await page.unroute("**/api/generate-stories");
  await page.route("**/api/generate-stories", async (route) => {
    requestCount += 1;
    const body = route.request().postDataJSON();

    if (requestCount === 1) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ output: MOCK_STORY }),
      });
      return;
    }

    expect(body.messages.length).toBeGreaterThan(1);
    expect(body.sessionId).toBeTruthy();
    expect(body.messages.at(-1)).toMatchObject({
      role: "user",
      content: "Add a mysterious stranger.",
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ output: continuation }),
    });
  });

  await page.locator("#seed").fill("A violinist in Buenos Aires");
  await page.locator("#tone").fill("romantic cyberpunk");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.locator("#output pre")).toContainText("violinist in Buenos Aires");

  await page.locator("#continuePrompt").fill("Add a mysterious stranger.");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.locator("#output pre")).toContainText("hidden alley", {
    timeout: 15_000,
  });
  await expect(page.locator("#output pre")).toContainText("violinist in Buenos Aires");
});
