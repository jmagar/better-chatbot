import { serverCache } from "lib/cache";

const CACHE_PREFIX = "gateway";
const PRESET_CONFIG_TTL_MS = 5 * 60 * 1000; // 5 minutes
const TOOL_CATALOG_TTL_MS = 15 * 60 * 1000; // 15 minutes

export const gatewayCache = {
  async getPresetConfig(slug: string) {
    const key = `${CACHE_PREFIX}:preset:${slug}:config`;
    return serverCache.get(key);
  },

  async setPresetConfig(slug: string, config: unknown) {
    const key = `${CACHE_PREFIX}:preset:${slug}:config`;
    await serverCache.set(key, config, PRESET_CONFIG_TTL_MS);
  },

  async getToolCatalog(slug: string) {
    const key = `${CACHE_PREFIX}:preset:${slug}:tools`;
    return serverCache.get(key);
  },

  async setToolCatalog(slug: string, tools: unknown) {
    const key = `${CACHE_PREFIX}:preset:${slug}:tools`;
    await serverCache.set(key, tools, TOOL_CATALOG_TTL_MS);
  },

  async invalidatePreset(slug: string) {
    await serverCache.deletePattern(`${CACHE_PREFIX}:preset:${slug}:*`);
  },

  async invalidateAllPresets() {
    await serverCache.deletePattern(`${CACHE_PREFIX}:preset:*`);
  },
};
