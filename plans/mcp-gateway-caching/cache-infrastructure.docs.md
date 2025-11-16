# Cache Infrastructure Research

## Summary
The codebase uses an in-memory cache (`MemoryCache`) by default in development, with a commented-out Redis fallback option (`SafeRedisCache`). The cache implements a simple async key-value interface with TTL support. Currently, there is NO pattern-based deletion capability - only individual key deletion is supported. The existing cache is used for MCP server customizations (30-min TTL) and agent instructions (no TTL).

## Key Components

- `/compose/better-chatbot/src/lib/cache/cache.interface.ts`: Core `Cache` interface defining the API contract
- `/compose/better-chatbot/src/lib/cache/index.ts`: Factory function `createCache()` and singleton `serverCache` instance
- `/compose/better-chatbot/src/lib/cache/memory-cache.ts`: In-memory implementation with TTL and automatic cleanup
- `/compose/better-chatbot/src/lib/cache/redis-cache.ts`: Redis implementation (not currently used)
- `/compose/better-chatbot/src/lib/cache/safe-redis-cache.ts`: Redis wrapper with automatic fallback to memory cache
- `/compose/better-chatbot/src/lib/cache/cache-keys.ts`: Cache key naming conventions
- `/compose/better-chatbot/src/app/api/chat/actions.ts`: Primary usage examples (`rememberMcpServerCustomizationsAction`, `rememberAgentAction`)

## Cache Interface API

```typescript
interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttlMs?: number): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  getAll(): Promise<Map<string, unknown>>;
}
```

### Factory Function
```typescript
// From /compose/better-chatbot/src/lib/cache/index.ts
const createCache = () => {
  const redisUrl = process.env.REDIS_URL;

  if (IS_DEV) {
    return new MemoryCache();  // Always used in dev
  }

  // Redis code is commented out (lines 20-38)
  return new MemoryCache();  // Currently always returns MemoryCache
};

// Singleton instance
export const serverCache = globalThis.__server__cache__ || createCache();
```

## Implementation Patterns

### Pattern 1: Cache-Aside (Lazy Loading)
**Location:** `/compose/better-chatbot/src/app/api/chat/actions.ts:143-192`

```typescript
export async function rememberMcpServerCustomizationsAction(userId: string) {
  const key = CacheKeys.mcpServerCustomizations(userId);

  // 1. Check cache first
  const cachedMcpServerCustomizations =
    await serverCache.get<Record<string, McpServerCustomizationsPrompt>>(key);
  if (cachedMcpServerCustomizations) {
    return cachedMcpServerCustomizations;
  }

  // 2. Query database if cache miss
  const mcpServerCustomizations =
    await mcpServerCustomizationRepository.selectByUserId(userId);
  const mcpToolCustomizations =
    await mcpMcpToolCustomizationRepository.selectByUserId(userId);

  // 3. Transform and aggregate data
  const prompts = /* ... data transformation ... */;

  // 4. Store in cache with TTL
  serverCache.set(key, prompts, 1000 * 60 * 30); // 30 minutes
  return prompts;
}
```

### Pattern 2: Write-Through Invalidation
**Location:** `/compose/better-chatbot/src/app/api/mcp/server-customizations/[server]/route.ts:27-53`

```typescript
export async function POST(request: Request, { params }) {
  // 1. Update database
  const result = await mcpServerCustomizationRepository.upsertMcpServerCustomization({
    userId: session.user.id,
    mcpServerId,
    prompt,
  });

  // 2. Invalidate cache immediately
  const key = CacheKeys.mcpServerCustomizations(session.user.id);
  void serverCache.delete(key);  // Fire-and-forget with void

  return NextResponse.json(result);
}
```

### Pattern 3: Infinite TTL Caching
**Location:** `/compose/better-chatbot/src/app/api/chat/actions.ts:215-227`

```typescript
export async function rememberAgentAction(agent: string | undefined, userId: string) {
  if (!agent) return undefined;
  const key = CacheKeys.agentInstructions(agent);

  let cachedAgent = await serverCache.get<Agent | null>(key);
  if (!cachedAgent) {
    cachedAgent = await agentRepository.selectAgentById(agent, userId);
    await serverCache.set(key, cachedAgent); // No TTL = Infinity
  }
  return cachedAgent as Agent | undefined;
}
```

## Key Naming Conventions

**Location:** `/compose/better-chatbot/src/lib/cache/cache-keys.ts`

```typescript
export const CacheKeys = {
  thread: (threadId: string) => `thread-${threadId}`,
  user: (userId: string) => `user-${userId}`,
  mcpServerCustomizations: (userId: string) => `mcp-server-customizations-${userId}`,
  agentInstructions: (agent: string) => `agent-instructions-${agent}`,
};
```

**Naming Pattern:**
- Format: `{resource}-{identifier}` (kebab-case resource, dynamic identifier)
- Scoped by entity ID (userId, threadId, serverId)
- Descriptive and collision-resistant
- No namespace prefixes currently used

## TTL Strategies

| Use Case | TTL | Rationale | Location |
|----------|-----|-----------|----------|
| MCP Server Customizations | 30 minutes | User-specific prompts change infrequently | `actions.ts:190` |
| Agent Instructions | Infinity | Agent configs rarely change, manually invalidated | `actions.ts:224` |
| Memory Cache Default | Infinity | No expiration unless explicitly set | `memory-cache.ts:13` |

## Invalidation Patterns

### Manual Invalidation (Current Approach)
```typescript
// Single key deletion after mutation
await serverCache.delete(CacheKeys.mcpServerCustomizations(userId));

// Used in: POST/DELETE endpoints for MCP customizations and agents
```

### Batch Invalidation (Not Implemented)
The current `Cache` interface does NOT support:
- Pattern-based deletion (e.g., `deletePattern("gateway:*")`)
- Prefix-based deletion
- Bulk key deletion

**Workaround:** The `RedisCache.clear()` method DOES support prefix-based clearing when `keyPrefix` is set:
```typescript
// From redis-cache.ts:67-76
async clear(): Promise<void> {
  if (this.keyPrefix) {
    const keys = await this.redis.keys(this.keyPrefix + "*");
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  } else {
    await this.redis.flushdb();
  }
}
```

However, this only works with instance-level `keyPrefix` set in constructor - NOT for arbitrary pattern deletion.

## Redis vs In-Memory

### Current State
- **Development:** Always uses `MemoryCache`
- **Production:** `MemoryCache` (Redis code commented out at `index.ts:20-38`)
- **Fallback:** `SafeRedisCache` provides automatic fallback but is not instantiated

### SafeRedisCache Features (Available but Unused)
- Automatic failover to `MemoryCache` on Redis errors
- Retry logic with exponential backoff (max 3 retries, 60s delay)
- Write-through to both Redis + memory on `set()`
- Handles rate limits, OOM errors, connection failures
- Status introspection via `isUsingRedis()` and `getCacheStatus()`

### Memory Cache Features (Currently Active)
- Automatic cleanup via `setInterval` (default: 60s sweep)
- TTL support with millisecond precision
- Type-safe generics for retrieval
- Stores any JSON-serializable value
- No size limits (bounded only by process memory)

## Considerations

### Missing Capabilities
1. **No Pattern Deletion:** Cannot invalidate cache keys by prefix/pattern (e.g., all gateway presets for a user)
2. **No Bulk Operations:** No `mget`/`mset` support for batching
3. **No Cache Statistics:** No hit/miss rates, eviction counts, or size metrics
4. **No Distributed Caching:** Memory cache is per-process (problematic for horizontal scaling)
5. **No Persistence:** Cache cleared on server restart

### Current Limitations
- **Void Pattern:** Several places use `void serverCache.delete(key)` - errors are silently ignored
- **No Cache Warming:** No proactive loading of frequently accessed keys
- **Manual Invalidation:** Developers must remember to invalidate on writes (error-prone)
- **No Cache Versioning:** Schema changes require manual invalidation or key rotation

### Edge Cases
- **Expired Entry Cleanup:** `MemoryCache` sweeps every 60s, but `get()` also checks/deletes expired entries on access
- **TTL Precision:** Uses `Date.now()` comparisons - subject to system clock changes
- **Type Safety:** `get<T>()` returns `T | undefined` but doesn't validate shape at runtime

### Gateway-Specific Concerns
For the MCP Gateway implementation:
1. **Multi-Key Invalidation:** When a gateway preset is updated, need to invalidate:
   - Preset catalog cache
   - User's preset list cache
   - OAuth access token cache (if access control changes)
   - Tool catalog cache for the preset

   Current approach: Individual `delete()` calls - no transactional invalidation

2. **Cache Key Explosion:** Each preset could generate multiple cache entries:
   - `gateway:preset:{presetId}` - preset metadata
   - `gateway:catalog:{presetId}` - filtered tool catalog
   - `gateway:access:{presetId}:{userId}` - access permissions
   - `gateway:metrics:{presetId}` - usage statistics

3. **Suggested Key Namespacing:**
   ```typescript
   gateway:preset:{presetId}         // Preset config
   gateway:catalog:{presetId}        // Tool catalog
   gateway:access:{presetId}:*       // Access tokens (pattern deletable)
   gateway:metrics:{presetId}:{day}  // Daily metrics
   ```

4. **Invalidation Strategy:**
   - On preset update: Delete `gateway:preset:{id}` and `gateway:catalog:{id}`
   - On tool toggle: Delete `gateway:catalog:{id}` only
   - On access revoked: Need to delete `gateway:access:{id}:{userId}` or use pattern deletion
   - On preset delete: Need to delete ALL `gateway:*:{id}:*` keys

## Next Steps

### Option 1: Extend Cache Interface (Recommended)
Add pattern-based deletion to the `Cache` interface:

```typescript
interface Cache {
  // ... existing methods ...
  deletePattern?(pattern: string): Promise<number>; // Returns count of deleted keys
}
```

Implement in:
- `MemoryCache`: Iterate Map keys and match with simple glob patterns
- `RedisCache`: Use `SCAN` + `UNLINK` for safe production pattern deletion
- `SafeRedisCache`: Delegate to underlying cache

### Option 2: Use Key Prefixes (Quick Fix)
Create separate cache instances with prefixes:

```typescript
const gatewayCache = new RedisCache({ keyPrefix: 'gateway:' });
// gatewayCache.clear() will delete all gateway:* keys
```

### Option 3: Manual Batch Deletion (Current Approach)
Track related keys in application code and delete individually:

```typescript
async function invalidatePresetCache(presetId: string) {
  await Promise.all([
    serverCache.delete(`gateway:preset:${presetId}`),
    serverCache.delete(`gateway:catalog:${presetId}`),
    // ... etc
  ]);
}
```

### Recommendation for Gateway
Given the planned MCP Gateway features (preset virtualization, per-tool controls, OAuth gating):

1. **Add `deletePattern()` method** to Cache interface - essential for cleaning up access tokens and related keys
2. **Use Redis in production** - required for multi-instance deployments and SSE connection state
3. **Implement cache key versioning** - embed schema version in keys (e.g., `v1:gateway:preset:{id}`)
4. **Add cache warming** - preload preset catalogs on startup
5. **Consider TTL strategy:**
   - Preset metadata: 5 minutes (infrequent changes)
   - Tool catalogs: 15 minutes (moderate change frequency)
   - Access tokens: 1 hour (balance security vs performance)
   - Metrics: 24 hours (historical data)
