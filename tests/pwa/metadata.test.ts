// tests/pwa/metadata.test.ts
import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Get the project root (two directories up from tests/pwa/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");

describe("PWA Metadata", () => {
  it("should have manifest reference in layout.tsx", async () => {
    const layoutPath = path.join(projectRoot, "src", "app", "layout.tsx");
    const layoutContent = await fs.readFile(layoutPath, "utf-8");

    // Should reference manifest.json
    expect(layoutContent).toContain("manifest:");
    expect(layoutContent).toContain("/manifest.json");
  });

  it("should have apple-web-app-capable meta configuration", async () => {
    const layoutPath = path.join(projectRoot, "src", "app", "layout.tsx");
    const layoutContent = await fs.readFile(layoutPath, "utf-8");

    // Should have appleWebApp configuration
    expect(layoutContent).toContain("appleWebApp:");
    expect(layoutContent).toContain("capable: true");
  });

  it("should have icon configuration", async () => {
    const layoutPath = path.join(projectRoot, "src", "app", "layout.tsx");
    const layoutContent = await fs.readFile(layoutPath, "utf-8");

    // Should have icons configuration
    expect(layoutContent).toContain("icons:");
    expect(layoutContent).toContain("apple:");
  });

  it("should have viewport configuration", async () => {
    const layoutPath = path.join(projectRoot, "src", "app", "layout.tsx");
    const layoutContent = await fs.readFile(layoutPath, "utf-8");

    // Should have viewport configuration
    expect(layoutContent).toContain("viewport:");
    expect(layoutContent).toContain("device-width");
  });

  it("should have theme color configuration", async () => {
    const layoutPath = path.join(projectRoot, "src", "app", "layout.tsx");
    const layoutContent = await fs.readFile(layoutPath, "utf-8");

    // Should have themeColor configuration
    expect(layoutContent).toContain("themeColor:");
  });
});
