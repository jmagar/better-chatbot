// src/app/pwa/manifest.test.ts
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

describe("PWA Manifest", () => {
  it("should have valid manifest.json with required fields", () => {
    const manifestPath = path.join(process.cwd(), "public", "manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifestContent = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestContent);

    // Required fields for Android installability
    expect(manifest.name).toBeDefined();
    expect(manifest.short_name).toBeDefined();
    expect(manifest.start_url).toBeDefined();
    expect(manifest.display).toBeDefined();
    expect(manifest.background_color).toBeDefined();
    expect(manifest.theme_color).toBeDefined();
    expect(manifest.icons).toBeDefined();
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

    // Validate icon sizes
    const iconSizes = manifest.icons.map((icon: ManifestIcon) => icon.sizes);
    expect(iconSizes).toContain("192x192");
    expect(iconSizes).toContain("512x512");
  });
});
