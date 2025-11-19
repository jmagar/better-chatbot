import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("PWA manifest link", () => {
  it("defines a manifest link tag for install prompts", () => {
    const headPath = path.join(process.cwd(), "src", "app", "head.tsx");

    expect(fs.existsSync(headPath)).toBe(true);

    const headContent = fs.readFileSync(headPath, "utf-8");

    expect(headContent).toMatch(/rel="manifest"/);
    expect(headContent).toMatch(/href="\/manifest\.json"/);
  });
});
