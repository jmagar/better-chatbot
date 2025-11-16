import { describe, it, expect, beforeEach } from "vitest";
import { MemoryCache } from "@/lib/cache/memory-cache";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("MemoryCache with pattern deletion", () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache({ maxSize: 100, maxMemoryMB: 10 });
  });

  it("should delete keys matching pattern", async () => {
    await cache.set("gateway:preset:123:config", { name: "test" });
    await cache.set("gateway:preset:123:tools", { tools: [] });
    await cache.set("gateway:preset:456:config", { name: "other" });
    await cache.set("other:key", { data: "value" });

    await cache.deletePattern("gateway:preset:123:*");

    expect(await cache.get("gateway:preset:123:config")).toBeUndefined();
    expect(await cache.get("gateway:preset:123:tools")).toBeUndefined();
    expect(await cache.get("gateway:preset:456:config")).toBeDefined();
    expect(await cache.get("other:key")).toBeDefined();
  });

  it("should reject complex patterns (ReDoS protection)", async () => {
    await expect(cache.deletePattern("*".repeat(101))).rejects.toThrow(
      "Pattern too complex",
    );
  });

  it("should reject too many wildcards", async () => {
    await expect(cache.deletePattern("*:*:*:*:*:*")).rejects.toThrow(
      "Too many wildcards",
    );
  });

  it("should evict LRU when maxSize exceeded", async () => {
    const smallCache = new MemoryCache({ maxSize: 3 });

    await smallCache.set("key1", "value1");
    await sleep(5);
    await smallCache.set("key2", "value2");
    await sleep(5);
    await smallCache.set("key3", "value3");

    // Access key1 to make it recently used
    await sleep(5);
    await smallCache.get("key1");

    // Add key4, should evict key2 (least recently used)
    await sleep(5);
    await smallCache.set("key4", "value4");

    expect(await smallCache.get("key1")).toBe("value1");
    expect(await smallCache.get("key2")).toBeUndefined(); // Evicted
    expect(await smallCache.get("key3")).toBe("value3");
    expect(await smallCache.get("key4")).toBe("value4");
  });

  it("should handle empty pattern gracefully", async () => {
    await cache.set("key1", "value1");
    await expect(cache.deletePattern("")).rejects.toThrow();
  });

  it("should delete multiple keys with prefix pattern", async () => {
    await cache.set("user:1:profile", { name: "Alice" });
    await cache.set("user:1:settings", { theme: "dark" });
    await cache.set("user:1:posts", [1, 2, 3]);
    await cache.set("user:2:profile", { name: "Bob" });

    await cache.deletePattern("user:1:*");

    expect(await cache.get("user:1:profile")).toBeUndefined();
    expect(await cache.get("user:1:settings")).toBeUndefined();
    expect(await cache.get("user:1:posts")).toBeUndefined();
    expect(await cache.get("user:2:profile")).toBeDefined();
  });

  it("should use LRU based on access time not insertion time", async () => {
    const smallCache = new MemoryCache({ maxSize: 3 });

    await smallCache.set("key1", "value1");
    await sleep(5);
    await smallCache.set("key2", "value2");
    await sleep(5);
    await smallCache.set("key3", "value3");

    // Access key1 and key2 (key3 becomes LRU)
    await sleep(5);
    await smallCache.get("key1");
    await sleep(5);
    await smallCache.get("key2");

    // Add key4, should evict key3
    await sleep(5);
    await smallCache.set("key4", "value4");

    expect(await smallCache.get("key1")).toBe("value1");
    expect(await smallCache.get("key2")).toBe("value2");
    expect(await smallCache.get("key3")).toBeUndefined(); // Evicted
    expect(await smallCache.get("key4")).toBe("value4");
  });

  it("should handle pattern with no matches", async () => {
    await cache.set("key1", "value1");
    await cache.deletePattern("nonexistent:*");
    expect(await cache.get("key1")).toBeDefined();
  });

  it("should validate maxSize and maxMemoryMB options", () => {
    const cache1 = new MemoryCache({ maxSize: 5000 });
    expect(cache1).toBeDefined();

    const cache2 = new MemoryCache({ maxMemoryMB: 50 });
    expect(cache2).toBeDefined();

    const cache3 = new MemoryCache();
    expect(cache3).toBeDefined();
  });
});
