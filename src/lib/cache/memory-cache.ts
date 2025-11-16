import type { Cache } from "./cache.interface";

interface CacheEntry {
  value: unknown;
  expiresAt: number;
  lastAccessed: number;
}

export interface MemoryCacheOptions {
  defaultTtlMs?: number;
  cleanupIntervalMs?: number;
  maxSize?: number;
  maxMemoryMB?: number;
}

export class MemoryCache implements Cache {
  private cache: Map<string, CacheEntry>;
  private prefixIndex: Map<string, Set<string>>;
  private defaultTtlMs: number;
  private maxSize: number;
  private maxMemoryMB: number;

  constructor(opts: MemoryCacheOptions = {}) {
    this.cache = new Map();
    this.prefixIndex = new Map();
    this.defaultTtlMs = opts.defaultTtlMs ?? Infinity;
    this.maxSize = opts.maxSize ?? 10000;
    this.maxMemoryMB = opts.maxMemoryMB ?? 100;

    const interval = opts.cleanupIntervalMs ?? 60_000;
    if (isFinite(interval) && interval > 0) {
      setInterval(() => this.sweep(), interval).unref();
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.removeFromPrefixIndex(key);
      return undefined;
    }

    entry.lastAccessed = Date.now();

    return entry.value as T;
  }

  async set(
    key: string,
    value: unknown,
    ttlMs = this.defaultTtlMs,
  ): Promise<void> {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const estimatedSize = JSON.stringify(value).length;
    if (estimatedSize > this.maxMemoryMB * 1024 * 1024 * 0.1) {
      throw new Error(
        `Cache value too large (max ${this.maxMemoryMB * 0.1}MB per entry)`,
      );
    }

    const expiresAt = isFinite(ttlMs) ? Date.now() + ttlMs : Infinity;

    this.cache.set(key, {
      value,
      expiresAt,
      lastAccessed: Date.now(),
    });

    this.addToPrefixIndex(key);
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== undefined;
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.removeFromPrefixIndex(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.prefixIndex.clear();
  }

  async deletePattern(pattern: string): Promise<void> {
    if (!pattern || pattern.length === 0) {
      throw new Error("Pattern cannot be empty");
    }

    if (pattern.length > 100) {
      throw new Error("Pattern too complex (max 100 chars)");
    }

    const asteriskCount = (pattern.match(/\*/g) || []).length;
    if (asteriskCount > 5) {
      throw new Error("Too many wildcards (max 5)");
    }

    if (pattern.endsWith(":*") && asteriskCount === 1) {
      const prefix = pattern.slice(0, -2);
      const keys = this.prefixIndex.get(prefix) ?? new Set();

      for (const key of keys) {
        this.cache.delete(key);
      }
      this.prefixIndex.delete(prefix);
      return;
    }

    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "[^:]*");

    const regex = new RegExp(`^${regexPattern}$`);

    const keysToDelete: string[] = [];
    let iterations = 0;
    const MAX_ITERATIONS = 10000;

    for (const key of this.cache.keys()) {
      if (++iterations > MAX_ITERATIONS) {
        throw new Error("Pattern matches too many keys");
      }
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.removeFromPrefixIndex(key);
    }
  }

  async getAll(): Promise<Map<string, unknown>> {
    const result = new Map<string, unknown>();
    const now = Date.now();

    for (const [key, entry] of this.cache) {
      if (now <= entry.expiresAt) {
        result.set(key, entry.value);
      } else {
        this.cache.delete(key);
        this.removeFromPrefixIndex(key);
      }
    }

    return result;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.removeFromPrefixIndex(oldestKey);
    }
  }

  private addToPrefixIndex(key: string): void {
    const parts = key.split(":");
    for (let i = 0; i < parts.length; i++) {
      const prefix = parts.slice(0, i + 1).join(":");
      if (!this.prefixIndex.has(prefix)) {
        this.prefixIndex.set(prefix, new Set());
      }
      this.prefixIndex.get(prefix)!.add(key);
    }
  }

  private removeFromPrefixIndex(key: string): void {
    const parts = key.split(":");
    for (let i = 0; i < parts.length; i++) {
      const prefix = parts.slice(0, i + 1).join(":");
      const keys = this.prefixIndex.get(prefix);
      if (keys) {
        keys.delete(key);
        if (keys.size === 0) {
          this.prefixIndex.delete(prefix);
        }
      }
    }
  }

  private sweep(): void {
    const now = Date.now();
    for (const [k, { expiresAt }] of this.cache) {
      if (now > expiresAt) {
        this.cache.delete(k);
        this.removeFromPrefixIndex(k);
      }
    }
  }
}
