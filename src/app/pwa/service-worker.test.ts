import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Service Worker", () => {
  it("should have service-worker.js file", () => {
    const swPath = path.join(process.cwd(), "public", "service-worker.js");
    expect(fs.existsSync(swPath)).toBe(true);

    const swContent = fs.readFileSync(swPath, "utf-8");

    // Should have install event listener
    expect(swContent).toContain("install");

    // Should have activate event listener
    expect(swContent).toContain("activate");

    // Should have fetch event listener (even if minimal)
    expect(swContent).toContain("fetch");
  });

  it("should have valid JavaScript syntax", () => {
    const swPath = path.join(process.cwd(), "public", "service-worker.js");
    const swContent = fs.readFileSync(swPath, "utf-8");

    // Basic syntax check - should not throw
    expect(() => new Function(swContent)).not.toThrow();
  });
});
