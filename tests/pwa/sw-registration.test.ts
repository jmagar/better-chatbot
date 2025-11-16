import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Service Worker Registration", () => {
  it("should have register-sw.tsx component", () => {
    const regPath = path.join(process.cwd(), "src", "app", "register-sw.tsx");
    expect(fs.existsSync(regPath)).toBe(true);

    const regContent = fs.readFileSync(regPath, "utf-8");

    // Should be a client component
    expect(regContent).toContain('"use client"');

    // Should register service worker
    expect(regContent).toContain("navigator.serviceWorker");
    expect(regContent).toContain(".register");
    expect(regContent).toContain("/service-worker.js");

    // Should use useEffect for browser-only registration
    expect(regContent).toContain("useEffect");
  });

  it("should include RegisterSW component in layout", () => {
    const layoutPath = path.join(process.cwd(), "src", "app", "layout.tsx");
    const layoutContent = fs.readFileSync(layoutPath, "utf-8");

    // Should import RegisterSW
    expect(layoutContent).toContain('from "./register-sw"');

    // Should render RegisterSW component
    expect(layoutContent).toContain("<RegisterSW />");
  });
});
