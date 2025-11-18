import { test, expect } from "@playwright/test";

import { TEST_USERS } from "../constants/test-users";

const loginAs = async (page, user: typeof TEST_USERS.admin) => {
  await page.goto("/sign-in");
  await page.locator("#email").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/mcp/, { timeout: 10000 });
};

test.describe("MCP export permissions", () => {
  test("export API requires authentication", async ({ request }) => {
    const response = await request.get("/api/mcp/export");

    expect(response.status()).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Unauthorized");
  });

  test("clipboard copy buttons correlate with exported config keys", async ({
    page,
  }) => {
    await loginAs(page, TEST_USERS.admin);

    const copyButtons = page.locator('[data-testid^="copy-config-"]');
    await expect(copyButtons.first()).toBeVisible();

    const serverNames: string[] = [];
    const count = await copyButtons.count();
    for (let i = 0; i < count; i += 1) {
      const testId = await copyButtons.nth(i).getAttribute("data-testid");
      if (typeof testId === "string") {
        serverNames.push(testId.replace("copy-config-", ""));
      }
    }

    const response = await page.request.get("/api/mcp/export");
    expect(response.ok()).toBe(true);
    const exported = await response.json();
    serverNames.forEach((name) => {
      expect(exported[name]).toBeDefined();
    });
  });

  test("non-owned featured cards do not expose copy buttons", async ({
    page,
  }) => {
    await loginAs(page, TEST_USERS.admin);

    const featuredCard = page.locator(
      '[data-testid="mcp-server-card"][data-featured="true"]',
    );
    const featuredCount = await featuredCard.count();
    if (featuredCount === 0) {
      test.skip(true, "No featured MCP servers available");
      return;
    }

    const copyButton = featuredCard.locator('[data-testid^="copy-config-"]');
    await expect(copyButton).toHaveCount(0);
  });
});
