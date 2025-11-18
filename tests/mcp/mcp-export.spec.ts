import fs from "node:fs/promises";
import path from "node:path";

import { test, expect } from "@playwright/test";

import { TEST_USERS } from "../constants/test-users";

const loginAs = async (page, user: typeof TEST_USERS.admin) => {
  await page.goto("/sign-in");
  await page.locator("#email").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/mcp/, { timeout: 10000 });
};

test.describe("MCP export UI", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USERS.admin);
  });

  test("copies individual server config to clipboard", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const copyButton = page.locator('[data-testid^="copy-config-"]').first();
    await expect(copyButton).toBeVisible();

    await copyButton.click();
    await expect(
      page.getByText(/configuration copied to clipboard/i),
    ).toBeVisible();

    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(() => JSON.parse(clipboardText)).not.toThrow();
    const parsed = JSON.parse(clipboardText);
    expect(Object.keys(parsed).length).toBeGreaterThan(0);
  });

  test("shows export dropdown", async ({ page }) => {
    await page
      .locator('[data-testid="add-mcp-server-button-dropdown"]')
      .click();
    await expect(page.getByText(/export all servers/i)).toBeVisible();
  });

  test("downloads JSON when export all is clicked", async ({
    page,
  }, testInfo) => {
    const downloadPromise = page.waitForEvent("download");

    await page
      .locator('[data-testid="add-mcp-server-button-dropdown"]')
      .click();
    await page.getByText(/export all servers/i).click();

    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^mcp-config-\d{4}-\d{2}-\d{2}\.json$/);

    const downloadsDir = testInfo.outputPath("mcp-export-downloads");
    await fs.mkdir(downloadsDir, { recursive: true });
    const downloadPath = path.join(downloadsDir, filename);
    await download.saveAs(downloadPath);

    const content = await fs.readFile(downloadPath, "utf-8");
    const parsed = JSON.parse(content);
    expect(typeof parsed).toBe("object");
    expect(Object.keys(parsed).length).toBeGreaterThan(0);

    await fs.unlink(downloadPath);
  });

  test("navigates to create page when primary button clicked", async ({
    page,
  }) => {
    await page.locator('[data-testid="add-mcp-server-button"]').click();
    await expect(page).toHaveURL(/\/mcp\/create/);
  });
});
