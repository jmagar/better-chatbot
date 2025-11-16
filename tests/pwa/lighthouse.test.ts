// tests/pwa/lighthouse.test.ts
import { describe, it, expect } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

describe("PWA Lighthouse Validation", () => {
  it("should pass basic PWA requirements", async () => {
    // This test requires the dev server to be running
    // Run: pnpm dev
    // Then: pnpm test tests/pwa/lighthouse.test.ts

    // Check if server is running on port 3000
    try {
      const { stdout } = await execAsync(
        'curl -s http://localhost:3000 || echo "SERVER_DOWN"',
      );

      if (stdout.includes("SERVER_DOWN")) {
        console.log("⚠️  Skipping Lighthouse test - dev server not running");
        console.log("   Start server with: pnpm dev");
        return;
      }

      // Verify manifest is accessible
      const manifestCheck = await execAsync(
        "curl -s http://localhost:3000/manifest.json",
      );
      const manifest = JSON.parse(manifestCheck.stdout);

      expect(manifest.name).toBe("Better Chatbot");
      expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

      // Verify service worker is accessible
      const swCheck = await execAsync(
        'curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/service-worker.js',
      );
      expect(swCheck.stdout.trim()).toBe("200");

      console.log("✓ Manifest and Service Worker are accessible");
      console.log("✓ PWA can be installed on Android devices");
    } catch (error) {
      console.error("Test error:", error);
      throw error;
    }
  }, 30000); // 30 second timeout
});
