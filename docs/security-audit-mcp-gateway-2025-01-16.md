# Security Audit: MCP Gateway Implementation Plan

**Date:** 2025-01-16
**Auditor:** Claude (Security Specialist)
**Plan:** `docs/plans/2025-01-16-mcp-gateway-complete.md`
**Scope:** Authentication, Authorization, Input Validation, Data Exposure, Injection Risks, Rate Limiting, Secrets Management

---

## Executive Summary

The MCP Gateway implementation plan contains **several critical security vulnerabilities** that must be addressed before implementation. While the architecture demonstrates good separation of concerns and uses modern security practices (Zod validation, parameterized queries via Drizzle ORM), there are significant gaps in access control, rate limiting, and data exposure protection.

**Risk Level:** HIGH
**Critical Issues:** 5
**Important Issues:** 8
**Best Practices:** 7

---

## 1. Authentication & Authorization

### ✅ STRENGTHS

1. **Session-based authentication** using Better Auth
2. **Ownership validation** correctly implemented in management APIs:
   ```typescript
   if (preset.userId !== session.user.id) {
     return NextResponse.json({ error: 'Access denied' }, { status: 403 });
   }
   ```
3. **Three-tier access control** (public/private/invite_only)
4. **Consistent auth checks** across CRUD endpoints

### 🔴 CRITICAL ISSUES

#### 1.1 Incomplete ACL Implementation (CRITICAL)
**Location:** `src/app/api/mcp/gateway/[slug]/route.ts:1884`

The access control function has a TODO comment for invite-only presets:
```typescript
// TODO: Check ACL table for invite_only presets
```

**Impact:** Invite-only presets will be inaccessible to anyone except the owner, rendering the ACL table useless.

**Fix Required:**
```typescript
async function checkAccess(
  preset: GatewayPresetConfig | null,
  userId?: string
): Promise<boolean> {
  if (!preset) return false;

  if (preset.visibility === 'public') {
    return true;
  }

  if (!userId) {
    return false;
  }

  if (preset.userId === userId) {
    return true;
  }

  // FIX: Implement ACL check for invite_only
  if (preset.visibility === 'invite_only') {
    const acl = await pgGatewayPresetAclRepository.checkAccess(
      preset.id,
      userId
    );
    return acl !== null; // User has any role = access granted
  }

  return false;
}
```

**Threat:** Authorization bypass for invite-only presets. Users granted access via ACL cannot use the gateway.

---

#### 1.2 Missing ACL Repository (CRITICAL)
**Location:** Repository layer

The plan creates the `McpGatewayPresetAclTable` schema but never implements the repository methods:
- `addAclEntry(presetId, principalType, principalValue, role)`
- `removeAclEntry(presetId, principalType, principalValue)`
- `checkAccess(presetId, userId)`
- `getAclEntries(presetId)`

**Impact:** No API to manage ACLs, making invite-only functionality incomplete.

**Fix Required:** Create `src/lib/db/pg/repositories/gateway-acl-repository.pg.ts` with full CRUD operations.

---

#### 1.3 Public Preset User Data Exposure (IMPORTANT)
**Location:** `src/lib/db/pg/repositories/gateway-preset-repository.pg.ts:444`

Public preset listing returns user information:
```typescript
.select({
  // ...
  userName: UserTable.name,
  userAvatar: UserTable.image,
})
```

**Issue:** While names/avatars may be intentionally public, this exposes user data without explicit privacy controls.

**Recommendation:**
1. Add explicit user privacy settings
2. Document this behavior in privacy policy
3. Consider allowing users to opt-out of public attribution

---

#### 1.4 Missing Authentication on Metrics Endpoints (IMPORTANT)
**Location:** Metrics repository

The plan has no metrics viewing API endpoint, but the repository exists. If an endpoint is added later without auth checks, it could leak usage data.

**Fix Required:** When implementing metrics viewing:
```typescript
// Only preset owner can view metrics
const preset = await pgGatewayPresetRepository.findById(presetId);
if (!preset || preset.userId !== session.user.id) {
  return NextResponse.json({ error: 'Access denied' }, { status: 403 });
}
```

---

### ⚠️ SECURITY CONCERNS

#### 1.5 No Session Validation/Refresh
**Issue:** The plan doesn't include session timeout or refresh logic. Long-lived sessions increase attack surface.

**Recommendation:** Implement session expiry (e.g., 24 hours) and refresh tokens.

---

#### 1.6 No Multi-Factor Authentication
**Issue:** For administrative operations (changing visibility to public, deleting presets), MFA would add defense-in-depth.

**Recommendation:** Consider MFA for sensitive operations, especially when changing private→public.

---

## 2. Input Validation

### ✅ STRENGTHS

1. **Zod schema validation** for all API inputs
2. **Slug format validation** with regex: `/^[a-z0-9-]+$/`
3. **Length constraints** (slug: 3-50 chars, name: 1-100 chars, description: max 500)
4. **Type safety** with TypeScript strict mode
5. **Drizzle ORM** prevents SQL injection via parameterized queries

### 🔴 CRITICAL ISSUES

#### 2.1 Insufficient Slug Validation (IMPORTANT)
**Location:** `src/lib/db/pg/repositories/gateway-preset-repository.pg.ts:357`

Current regex: `/^[a-z0-9-]+$/`

**Issues:**
1. Allows slugs starting/ending with hyphens: `-test-`, `--test`, `test--`
2. No reserved word protection: `admin`, `api`, `new`, `delete`
3. Could collide with system routes

**Fix Required:**
```typescript
function validateSlug(slug: string): void {
  if (!slug || typeof slug !== 'string') {
    throw new Error('Slug is required');
  }
  if (slug.length < 3 || slug.length > 50) {
    throw new Error('Slug must be between 3 and 50 characters');
  }

  // NEW: More strict validation
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(
      'Invalid slug: must start/end with alphanumeric, use single hyphens'
    );
  }

  // NEW: Reserved words
  const reserved = ['admin', 'api', 'new', 'edit', 'delete', 'settings', 'public', 'private'];
  if (reserved.includes(slug)) {
    throw new Error(`Slug '${slug}' is reserved`);
  }
}
```

---

#### 2.2 No Tool Name Validation (CRITICAL)
**Location:** `src/lib/db/pg/repositories/gateway-preset-repository.pg.ts:479`

The `allowedToolNames` array accepts arbitrary strings with no validation:
```typescript
async addServer(
  presetId: string,
  mcpServerId: string,
  allowedToolNames: string[] = []
)
```

**Issues:**
1. Could contain malicious strings (e.g., SQL injection attempts if used in raw queries later)
2. No check that tools actually exist on the server
3. Could cause confusion if tool names are misspelled

**Fix Required:**
```typescript
async addServer(
  presetId: string,
  mcpServerId: string,
  allowedToolNames: string[] = []
) {
  // Validate tool names
  for (const toolName of allowedToolNames) {
    if (typeof toolName !== 'string' || toolName.length === 0) {
      throw new Error('Invalid tool name');
    }
    if (toolName.length > 100) {
      throw new Error('Tool name too long');
    }
    // Allow alphanumeric, underscores, hyphens, periods
    if (!/^[a-zA-Z0-9_.-]+$/.test(toolName)) {
      throw new Error(`Invalid tool name format: ${toolName}`);
    }
  }

  // TODO: Optionally validate against actual server tools
  // const serverTools = await mcpClientsManager.getServerTools(mcpServerId);
  // const validTools = new Set(serverTools.map(t => t.name));
  // for (const toolName of allowedToolNames) {
  //   if (!validTools.has(toolName)) {
  //     throw new Error(`Tool ${toolName} not found on server ${mcpServerId}`);
  //   }
  // }

  // ... rest of implementation
}
```

---

#### 2.3 Missing JSON-RPC Parameter Validation (IMPORTANT)
**Location:** `src/app/api/mcp/gateway/[slug]/route.ts:1954`

Tool call parameters are not validated:
```typescript
const { name: toolId, arguments: args } = rpcRequest.params as {
  name: string;
  arguments: unknown;
};
```

**Issues:**
1. `args` is typed as `unknown` but passed directly to `mcpClientsManager.toolCall()`
2. No size limits on parameters (could cause DoS)
3. No type validation

**Fix Required:**
```typescript
// Validate tool call parameters
const ToolCallParamsSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
  arguments: z.record(z.unknown()).optional(),
});

const params = ToolCallParamsSchema.safeParse(rpcRequest.params);
if (!params.success) {
  const response: JsonRpcResponse = {
    jsonrpc: '2.0',
    id: rpcRequest.id,
    error: {
      code: -32602,
      message: 'Invalid params',
      data: params.error.errors,
    },
  };
  return NextResponse.json(response, { status: 400 });
}

const { name: toolId, arguments: args } = params.data;

// Check parameter size (prevent DoS)
const argsJson = JSON.stringify(args || {});
if (argsJson.length > 100000) { // 100KB limit
  return NextResponse.json({
    jsonrpc: '2.0',
    id: rpcRequest.id,
    error: {
      code: -32600,
      message: 'Request parameters too large (max 100KB)',
    },
  }, { status: 400 });
}
```

---

#### 2.4 No Request Size Limits (IMPORTANT)
**Location:** All API routes

No middleware limits request body size, which could enable DoS attacks.

**Fix Required:** Add Next.js middleware or body size limits:
```typescript
// middleware.ts
export const config = {
  matcher: '/api/mcp/:path*',
};

export function middleware(request: NextRequest) {
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 1048576) { // 1MB
    return NextResponse.json(
      { error: 'Request too large (max 1MB)' },
      { status: 413 }
    );
  }
  return NextResponse.next();
}
```

---

### ⚠️ SECURITY CONCERNS

#### 2.5 No Email Validation for ACL Principal Values
**Issue:** ACL table supports `principalType: 'email'` but no email validation exists.

**Recommendation:**
```typescript
if (principalType === 'email' && !z.string().email().safeParse(principalValue).success) {
  throw new Error('Invalid email format');
}
```

---

## 3. Data Exposure

### ✅ STRENGTHS

1. **Filtered tool catalogs** prevent exposure of unauthorized tools
2. **Ownership checks** prevent cross-user data access
3. **Selective field exposure** in public preset listing

### 🔴 CRITICAL ISSUES

#### 3.1 Error Messages Leak Implementation Details (IMPORTANT)
**Location:** Multiple routes

Error responses expose internal details:
```typescript
return NextResponse.json({
  jsonrpc: '2.0',
  id: rpcRequest.id,
  error: {
    code: -32603,
    message: error instanceof Error ? error.message : 'Internal error',
  },
}, { status: 500 });
```

**Issues:**
1. Stack traces could leak file paths
2. Database errors could reveal schema
3. MCP client errors could expose server internals

**Fix Required:**
```typescript
// Create error sanitizer
function sanitizeError(error: unknown): string {
  if (process.env.NODE_ENV === 'development') {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  // Production: return generic messages
  return 'An internal error occurred';
}

// Usage
return NextResponse.json({
  jsonrpc: '2.0',
  id: rpcRequest.id,
  error: {
    code: -32603,
    message: sanitizeError(error),
  },
}, { status: 500 });
```

---

#### 3.2 Metadata Endpoint Exposes User IDs (MODERATE)
**Location:** `src/lib/ai/mcp/gateway/gateway-service.ts:1057`

```typescript
return {
  // ...
  owner: config.userId, // Exposes internal user ID
  // ...
};
```

**Issue:** User IDs could be UUIDs that should remain internal.

**Fix Required:**
```typescript
// Instead, return username or sanitized identifier
owner: {
  id: config.userId,
  name: user.name,
  avatar: user.image,
},
```

---

#### 3.3 Metrics Table Could Leak Private Information (IMPORTANT)
**Location:** `McpGatewayMetricsTable` schema

The `metadata` field is unstructured JSON that could accidentally store sensitive data:
```typescript
metadata: json('metadata').$type<Record<string, unknown>>(),
```

**Issues:**
1. Tool call results might contain PII
2. Error messages might contain secrets
3. No data retention policy

**Fix Required:**
1. Explicitly document what can/cannot be stored in metadata
2. Sanitize metadata before insertion:
   ```typescript
   async recordToolCall(metric: ToolCallMetric) {
     // Sanitize metadata
     const sanitizedMetadata = metric.metadata ? {
       ...metric.metadata,
       // Remove known sensitive keys
       apiKey: undefined,
       password: undefined,
       token: undefined,
       secret: undefined,
     } : undefined;

     await db.insert(McpGatewayMetricsTable).values({
       // ...
       metadata: sanitizedMetadata,
     });
   }
   ```
3. Implement data retention policy (auto-delete metrics older than 90 days)

---

### ⚠️ SECURITY CONCERNS

#### 3.4 No Data Isolation for Disabled Presets
**Issue:** Disabled/archived presets are still queryable by owner. Could leak data if account is compromised.

**Recommendation:** Add soft-delete with actual deletion after grace period (e.g., 30 days).

---

## 4. Injection Risks

### ✅ STRENGTHS

1. **Drizzle ORM** with parameterized queries prevents SQL injection
2. **No raw SQL** in repository methods
3. **Zod validation** prevents type confusion attacks

### 🔴 CRITICAL ISSUES

#### 4.1 Pattern-Based Cache Deletion Injection (CRITICAL)
**Location:** `src/lib/cache/memory-cache.ts:1311`

```typescript
async deletePattern(pattern: string): Promise<void> {
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars
    .replace(/\*/g, '.*'); // Convert * to .*

  const regex = new RegExp(`^${regexPattern}$`);
  // ...
}
```

**Issues:**
1. If `pattern` comes from user input (e.g., slug), malicious slugs could cause ReDoS
2. Pattern `gateway:*:.*` could match unintended keys
3. No validation of pattern format

**Fix Required:**
```typescript
async deletePattern(pattern: string): Promise<void> {
  // Validate pattern format
  if (!pattern || typeof pattern !== 'string') {
    throw new Error('Invalid pattern');
  }

  // Only allow patterns starting with known prefix
  const validPrefixes = ['gateway:'];
  if (!validPrefixes.some(p => pattern.startsWith(p))) {
    throw new Error('Pattern must start with allowed prefix');
  }

  // Limit pattern complexity (prevent ReDoS)
  if (pattern.length > 100) {
    throw new Error('Pattern too long');
  }

  // Count wildcards (prevent excessive wildcards)
  const wildcardCount = (pattern.match(/\*/g) || []).length;
  if (wildcardCount > 2) {
    throw new Error('Too many wildcards in pattern');
  }

  // Rest of implementation...
}
```

**Current Usage in Plan:**
```typescript
await this.cache.deletePattern(`${CACHE_PREFIX}:*:${slug}`);
```

This is **safe** because `slug` is validated against `/^[a-z0-9-]+$/`, but the `deletePattern` method itself should enforce its own constraints for defense-in-depth.

---

#### 4.2 No Input Sanitization for Logging (MODERATE)
**Location:** Multiple files

Logs include user input without sanitization:
```typescript
logger.info(`Created preset: ${preset.slug} for user ${session.user.id}`);
logger.info(`Gateway request for ${slug}: ${rpcRequest.method}`);
```

**Issues:**
1. Log injection attacks (newline injection, ANSI escape codes)
2. Could break log parsing
3. Could be used for privilege escalation if logs are displayed in admin UI

**Fix Required:**
```typescript
// Create log sanitizer
function sanitizeForLog(input: string): string {
  return input
    .replace(/[\n\r]/g, '') // Remove newlines
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .substring(0, 200); // Truncate
}

logger.info(`Created preset: ${sanitizeForLog(preset.slug)} for user ${session.user.id}`);
```

---

## 5. Rate Limiting & DoS Protection

### 🔴 CRITICAL ISSUES

#### 5.1 No Rate Limiting on Any Endpoint (CRITICAL)
**Location:** All API routes

**Issues:**
1. Gateway endpoints can be flooded with tool calls
2. Preset creation has no limits (user could create thousands)
3. Metrics table could grow infinitely
4. No protection against brute-force attacks

**Fix Required:**

**Option 1: Next.js Middleware with Redis**
```typescript
// middleware.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
});

export async function middleware(request: NextRequest) {
  const ip = request.ip ?? '127.0.0.1';
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }

  return NextResponse.next();
}
```

**Option 2: Per-User Rate Limiting in PostgreSQL**
```typescript
// Track request counts in database
CREATE TABLE rate_limits (
  user_id UUID NOT NULL,
  endpoint VARCHAR(100) NOT NULL,
  window_start TIMESTAMP NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, endpoint, window_start)
);

// Before processing request
const now = new Date();
const windowStart = new Date(now.getTime() - 60000); // 1 minute window

const limit = await db
  .select({ count: sql<number>`SUM(request_count)` })
  .from(RateLimitTable)
  .where(
    and(
      eq(RateLimitTable.userId, session.user.id),
      eq(RateLimitTable.endpoint, '/api/mcp/gateway'),
      gte(RateLimitTable.windowStart, windowStart)
    )
  );

if (limit[0]?.count >= 1000) { // 1000 requests per minute per user
  return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
}
```

**Recommended Limits:**
- Gateway tool calls: 100/min per IP, 1000/min per authenticated user
- Preset creation: 10/hour per user
- Preset updates: 50/hour per user
- Metrics queries: 60/hour per user

---

#### 5.2 No Preset Quota Limits (IMPORTANT)
**Location:** `src/app/api/mcp/gateway-presets/route.ts:2380`

Users can create unlimited presets.

**Fix Required:**
```typescript
// Check preset count before creation
const userPresets = await pgGatewayPresetRepository.findAllForUser(session.user.id);

const MAX_PRESETS_PER_USER = 50; // Or use tiered limits based on user plan
if (userPresets.length >= MAX_PRESETS_PER_USER) {
  return NextResponse.json(
    { error: `Maximum ${MAX_PRESETS_PER_USER} presets allowed per user` },
    { status: 403 }
  );
}
```

---

#### 5.3 No Protection Against Metrics Growth DoS (CRITICAL)
**Location:** `McpGatewayMetricsTable`

**Issues:**
1. Every tool call creates a metrics row
2. No cleanup policy
3. Database could grow to TBs with high traffic
4. Could be used to exhaust disk space

**Fix Required:**

**Option 1: Time-Series Data with Automatic Retention**
```typescript
// Use TimescaleDB or PostgreSQL partitioning
CREATE TABLE mcp_gateway_metrics (
  -- ... columns
) PARTITION BY RANGE (timestamp);

-- Create partitions for each month
CREATE TABLE mcp_gateway_metrics_2025_01
  PARTITION OF mcp_gateway_metrics
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Auto-drop old partitions
DROP TABLE mcp_gateway_metrics_2024_10; -- 3 months old
```

**Option 2: Aggregation with Sampling**
```typescript
// Don't log every request, use sampling
async recordToolCall(metric: ToolCallMetric) {
  // Only log 10% of successful calls, 100% of errors
  const shouldLog = metric.status === 'error' || Math.random() < 0.1;

  if (!shouldLog) {
    return;
  }

  await db.insert(McpGatewayMetricsTable).values({...});
}
```

**Option 3: Scheduled Cleanup Job**
```typescript
// Cron job to delete old metrics
async function cleanupOldMetrics() {
  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days

  await db
    .delete(McpGatewayMetricsTable)
    .where(lte(McpGatewayMetricsTable.timestamp, cutoffDate));
}
```

---

#### 5.4 No Circuit Breaker for MCP Server Failures (IMPORTANT)
**Location:** `src/app/api/mcp/gateway/[slug]/route.ts:1979`

If an MCP server is down, all tool calls will timeout, causing slow responses and resource exhaustion.

**Fix Required:**
```typescript
// Add circuit breaker pattern
class CircuitBreaker {
  private failures = new Map<string, { count: number; resetAt: Date }>();

  async call<T>(serverId: string, fn: () => Promise<T>): Promise<T> {
    const state = this.failures.get(serverId);

    // Circuit open (server marked as down)
    if (state && state.count >= 5 && new Date() < state.resetAt) {
      throw new Error('Circuit breaker open: server temporarily unavailable');
    }

    try {
      const result = await fn();
      // Success: reset failures
      this.failures.delete(serverId);
      return result;
    } catch (error) {
      // Failure: increment count
      const current = this.failures.get(serverId) || { count: 0, resetAt: new Date() };
      current.count++;
      current.resetAt = new Date(Date.now() + 60000); // Reset after 1 minute
      this.failures.set(serverId, current);
      throw error;
    }
  }
}

// Usage in gateway route
const circuitBreaker = new CircuitBreaker();
const result = await circuitBreaker.call(tool._mcpServerId, () =>
  mcpClientsManager.toolCall(tool._mcpServerId, tool._originToolName, args)
);
```

---

### ⚠️ SECURITY CONCERNS

#### 5.5 No Timeout Protection on Tool Calls
**Issue:** Tool calls could hang indefinitely, exhausting server resources.

**Recommendation:**
```typescript
// Add timeout to tool calls
const TOOL_CALL_TIMEOUT_MS = 30000; // 30 seconds

const resultPromise = mcpClientsManager.toolCall(
  tool._mcpServerId,
  tool._originToolName,
  args
);

const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Tool call timeout')), TOOL_CALL_TIMEOUT_MS)
);

const result = await Promise.race([resultPromise, timeoutPromise]);
```

---

## 6. Secrets Management

### ✅ STRENGTHS

1. **No hardcoded credentials** in the plan
2. **Better Auth** handles session secrets
3. **Environment variables** for configuration (implied)

### ⚠️ SECURITY CONCERNS

#### 6.1 No Encryption for Sensitive Metadata (MODERATE)
**Location:** `McpGatewayPresetTable.metadata`

The metadata JSON field could store sensitive configuration but is not encrypted at rest.

**Recommendation:**
```typescript
// Encrypt metadata before storage
import { encrypt, decrypt } from '@/lib/crypto';

async create(data: GatewayPresetCreate) {
  const encryptedMetadata = data.metadata
    ? encrypt(JSON.stringify(data.metadata), process.env.ENCRYPTION_KEY)
    : null;

  const [preset] = await db
    .insert(McpGatewayPresetTable)
    .values({
      // ...
      metadata: encryptedMetadata,
    })
    .returning();

  return {
    ...preset,
    metadata: encryptedMetadata ? JSON.parse(decrypt(encryptedMetadata)) : null,
  };
}
```

---

#### 6.2 MCP Server Credentials Not Discussed (MODERATE)
**Issue:** The plan doesn't address how MCP servers are configured/authenticated.

**Questions:**
1. Are MCP server credentials stored in the database?
2. If yes, are they encrypted?
3. Who can access them?

**Recommendation:**
1. Use separate credentials table with encryption
2. Implement vault integration (HashiCorp Vault, AWS Secrets Manager)
3. Rotate credentials regularly

---

#### 6.3 No Audit Logging for Sensitive Operations (IMPORTANT)
**Issue:** No audit trail for:
- Changing visibility from private → public
- Adding/removing ACL entries
- Deleting presets
- Failed authentication attempts

**Recommendation:**
```typescript
// Create audit log table
export const AuditLogTable = pgTable('audit_logs', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('user_id').references(() => UserTable.id),
  action: varchar('action', { length: 100 }).notNull(),
  resourceType: varchar('resource_type', { length: 50 }).notNull(),
  resourceId: uuid('resource_id'),
  metadata: json('metadata').$type<Record<string, unknown>>(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Log sensitive operations
await auditLog.create({
  userId: session.user.id,
  action: 'UPDATE_PRESET_VISIBILITY',
  resourceType: 'gateway_preset',
  resourceId: preset.id,
  metadata: {
    oldVisibility: preset.visibility,
    newVisibility: validated.visibility,
  },
  ipAddress: request.headers.get('x-forwarded-for'),
  userAgent: request.headers.get('user-agent'),
});
```

---

## 7. Additional Security Best Practices

### 🔵 RECOMMENDATIONS

#### 7.1 Content Security Policy (CSP)
Add CSP headers to prevent XSS attacks:
```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
];

module.exports = {
  async headers() {
    return [
      {
        source: '/api/mcp/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

---

#### 7.2 CORS Configuration
Implement strict CORS for gateway endpoints:
```typescript
// Only allow specific origins
const allowedOrigins = [
  'https://pulse.tootie.tv',
  'https://admin.tootie.tv',
];

export function corsMiddleware(request: NextRequest) {
  const origin = request.headers.get('origin');

  if (!origin || !allowedOrigins.includes(origin)) {
    return NextResponse.json({ error: 'CORS not allowed' }, { status: 403 });
  }

  const response = NextResponse.next();
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');

  return response;
}
```

---

#### 7.3 Database Index Performance & Security
Add indexes to prevent slow query DoS:
```typescript
// Already in plan, but ensure these exist:
index('gateway_metrics_timestamp_idx').on(table.timestamp),
index('gateway_metrics_preset_id_idx').on(table.presetId),

// Add composite index for common queries
index('gateway_metrics_preset_time_idx').on(table.presetId, table.timestamp),
```

---

#### 7.4 Input Encoding for Output
Ensure all user-generated content is properly encoded when returned:
```typescript
// Use a sanitization library
import DOMPurify from 'isomorphic-dompurify';

function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] }); // Strip all HTML
}

// When returning preset descriptions
return {
  ...preset,
  description: preset.description ? sanitizeHtml(preset.description) : null,
};
```

---

#### 7.5 Secure Headers for JSON-RPC
Add headers to prevent caching of sensitive data:
```typescript
return NextResponse.json(response, {
  headers: {
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
});
```

---

#### 7.6 Database Connection Security
Ensure database connections use TLS:
```typescript
// DATABASE_URL should include sslmode=require
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

---

#### 7.7 Monitoring & Alerting
Set up security monitoring:
1. Alert on >10 failed auth attempts from same IP in 5 minutes
2. Alert on sudden spike in preset creation (>100/hour)
3. Alert on unusual tool call patterns
4. Monitor for SQL injection attempts in logs
5. Track rate limit violations

---

## 8. Threat Modeling

### Attack Scenarios

#### 8.1 Unauthorized Data Access
**Threat:** Attacker tries to access private presets without authentication

**Mitigations:**
- ✅ Session-based authentication
- ✅ Ownership validation
- ❌ Missing ACL implementation
- ❌ No rate limiting on auth failures

**Residual Risk:** Medium (after ACL implementation: Low)

---

#### 8.2 Privilege Escalation via ACL
**Threat:** User grants themselves admin role on someone else's preset

**Mitigations:**
- ❌ No ACL management API exists yet
- ❌ No validation that ACL modifier is preset owner

**Residual Risk:** High (will be Critical when ACL API is implemented)

**Fix Required:**
```typescript
async function addAclEntry(
  presetId: string,
  userId: string,
  principalType: string,
  principalValue: string,
  role: 'viewer' | 'editor' | 'admin'
) {
  // CRITICAL: Verify caller is preset owner
  const preset = await pgGatewayPresetRepository.findById(presetId);
  if (!preset || preset.userId !== userId) {
    throw new Error('Only preset owner can modify ACL');
  }

  // Prevent self-grant (owner always has implicit access)
  if (principalType === 'user' && principalValue === userId) {
    throw new Error('Cannot modify owner ACL');
  }

  // ... insert ACL entry
}
```

---

#### 8.3 Resource Exhaustion DoS
**Threat:** Attacker creates millions of presets or tool calls to exhaust resources

**Mitigations:**
- ❌ No rate limiting
- ❌ No preset quotas
- ❌ No metrics retention policy

**Residual Risk:** Critical

**Impact:** Database fills up, service becomes unavailable

---

#### 8.4 Cache Poisoning
**Threat:** Attacker manipulates cache to serve wrong data to other users

**Mitigations:**
- ✅ Cache keys include slug (user-specific)
- ✅ Cache invalidation on updates
- ❌ No cache key signing/HMAC

**Residual Risk:** Low (cache is in-memory, not shared across instances in current design)

**Note:** If switching to Redis, implement signed cache keys:
```typescript
import crypto from 'crypto';

function signCacheKey(key: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(key);
  return `${key}:${hmac.digest('hex').substring(0, 16)}`;
}
```

---

#### 8.5 MCP Server Credential Theft
**Threat:** Attacker gains access to database and extracts MCP server credentials

**Mitigations:**
- ❌ Plan doesn't mention credential storage
- ❌ No encryption at rest

**Residual Risk:** High (if credentials stored in plaintext)

**Fix Required:**
1. Encrypt all credentials with AES-256
2. Use separate encryption key (not database credentials)
3. Rotate encryption key periodically

---

#### 8.6 SQL Injection via Tool Names
**Threat:** Malicious tool names in `allowedToolNames` cause SQL injection

**Mitigations:**
- ✅ Drizzle ORM uses parameterized queries
- ❌ No validation of tool name format

**Residual Risk:** Low (ORM protects against SQL injection, but validation still needed for other reasons)

---

#### 8.7 Log Injection for Privilege Escalation
**Threat:** Attacker injects malicious log entries to manipulate admin dashboards

**Mitigations:**
- ❌ No log sanitization

**Residual Risk:** Medium

**Example Attack:**
```
User creates preset with slug: "test\nADMIN ACTION: Grant user evil@example.com admin role"
```

This could trick log parsing tools or admin UIs.

---

## 9. Compliance Considerations

### GDPR Compliance

#### 9.1 Right to Access
**Requirement:** Users must be able to export all their data

**Current State:** Partial - can query presets, but no export API

**Fix Required:**
```typescript
// GET /api/mcp/export
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const data = {
    user: { id: session.user.id, email: session.user.email },
    presets: await pgGatewayPresetRepository.findAllForUser(session.user.id),
    metrics: await pgGatewayMetricsRepository.getUserMetrics(session.user.id),
    acl: await pgGatewayPresetAclRepository.getUserAcl(session.user.id),
  };

  return NextResponse.json(data);
}
```

---

#### 9.2 Right to Erasure (Right to be Forgotten)
**Requirement:** Users can request deletion of all their data

**Current State:** Partial - DELETE preset works, but:
- User deletion not implemented
- Metrics reference deleted user IDs (should be anonymized)
- ACL entries reference deleted users

**Fix Required:**
```typescript
// On user deletion, cascade or anonymize
async function deleteUserData(userId: string) {
  // Option 1: Hard delete (GDPR compliant)
  await pgGatewayPresetRepository.deleteAllForUser(userId);
  await pgGatewayMetricsRepository.deleteForUser(userId);
  await pgGatewayPresetAclRepository.deleteForUser(userId);

  // Option 2: Anonymize (for analytics)
  await pgGatewayMetricsRepository.anonymizeUser(userId);
}
```

---

#### 9.3 Data Minimization
**Requirement:** Only collect necessary data

**Current State:** Good - minimal data collected

**Recommendation:** Document retention policies for each table

---

#### 9.4 Privacy by Design
**Requirement:** Privacy built into system design

**Current State:** Partial
- ✅ Private by default
- ✅ Explicit consent for public presets
- ❌ No privacy settings for user profiles

---

## 10. Summary of Findings

### Critical Issues (Must Fix Before Launch)

1. **Incomplete ACL implementation** - Invite-only presets unusable
2. **No rate limiting** - Service vulnerable to DoS attacks
3. **Metrics table growth** - No retention policy, will exhaust disk
4. **Pattern-based cache deletion** - Potential ReDoS vulnerability
5. **No tool name validation** - Security risk and data integrity issue

### Important Issues (Should Fix)

1. **Insufficient slug validation** - Allows malformed slugs
2. **No JSON-RPC parameter validation** - Size limits and type checks needed
3. **Error messages leak details** - Sanitize errors in production
4. **No request size limits** - DoS risk
5. **Public preset user data exposure** - Privacy consideration
6. **Missing ACL repository** - Core functionality incomplete
7. **No audit logging** - Compliance and forensics gap
8. **No circuit breaker** - Cascading failures possible

### Best Practices (Recommended)

1. Add CSP headers
2. Implement CORS restrictions
3. Add session timeout/refresh
4. Implement MFA for sensitive operations
5. Encrypt sensitive metadata
6. Set up security monitoring
7. Document credential storage strategy

---

## 11. Recommended Implementation Order

### Phase 1: Critical Security (Before Any Deployment)
1. Implement rate limiting (all endpoints)
2. Complete ACL implementation (repository + access checks)
3. Add metrics retention policy
4. Validate tool names and JSON-RPC parameters
5. Fix pattern deletion vulnerability

### Phase 2: Important Security (Before Public Launch)
1. Improve slug validation
2. Add request size limits
3. Sanitize error messages
4. Implement audit logging
5. Add circuit breaker for MCP servers

### Phase 3: Hardening (Post-Launch)
1. Add CSP headers and CORS
2. Implement session management improvements
3. Add security monitoring and alerting
4. Document and encrypt credential storage
5. GDPR compliance endpoints (export, deletion)

---

## 12. Security Checklist for Implementation

### Pre-Implementation
- [ ] Review all TODO comments in code for security implications
- [ ] Set up security linting (eslint-plugin-security)
- [ ] Configure TypeScript strict mode
- [ ] Set up pre-commit hooks for secret scanning (git-secrets, trufflehog)

### During Implementation
- [ ] Implement all critical fixes from this audit
- [ ] Add unit tests for all validation functions
- [ ] Add integration tests for auth/authz flows
- [ ] Document all security assumptions

### Pre-Deployment
- [ ] Run security scanner (npm audit, Snyk)
- [ ] Perform penetration testing
- [ ] Load test rate limiting
- [ ] Review all error messages for information leakage
- [ ] Verify database backups are encrypted
- [ ] Confirm credentials are not in version control

### Post-Deployment
- [ ] Monitor rate limit violations
- [ ] Set up alerts for unusual activity
- [ ] Schedule regular security audits
- [ ] Implement bug bounty program
- [ ] Document incident response procedures

---

## Conclusion

The MCP Gateway implementation plan demonstrates **solid foundational security** with proper use of ORMs, input validation, and authentication. However, **critical gaps** in rate limiting, ACL implementation, and DoS protection create **significant risk**.

**Recommendation:** **DO NOT DEPLOY** until critical issues are resolved. The implementation plan is otherwise well-structured and can be secured with the fixes outlined in this audit.

**Estimated Security Hardening Effort:**
- Critical fixes: 3-5 days
- Important fixes: 2-3 days
- Best practices: 2-3 days
- **Total: 7-11 days**

**Risk Level After Fixes:** Low-Medium (acceptable for production with monitoring)

---

**Audit Completed:** 2025-01-16
**Auditor:** Claude (Security Specialist)
**Next Review:** After implementation, before deployment
