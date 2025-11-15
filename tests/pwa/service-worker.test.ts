import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import path from "path";

describe("Service Worker", () => {
  it("should have service-worker.js file", async () => {
    const swPath = path.join(process.cwd(), "public", "service-worker.js");

    // Check file exists
    await expect(fs.access(swPath)).resolves.toBeUndefined();

    const swContent = await fs.readFile(swPath, "utf-8");

    // Should have install event listener
    expect(swContent).toContain("install");

    // Should have activate event listener
    expect(swContent).toContain("activate");

    // Should have fetch event listener (even if minimal)
    expect(swContent).toContain("fetch");
  });

  it("should have valid JavaScript syntax", async () => {
    const swPath = path.join(process.cwd(), "public", "service-worker.js");
    const swContent = await fs.readFile(swPath, "utf-8");

    // Basic syntax check - should not throw
    expect(() => new Function(swContent)).not.toThrow();
  });
});
