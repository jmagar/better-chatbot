# MCP Gateway Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a shareable MCP gateway system that allows users to create preset-based virtual MCP servers with granular tool control, OAuth-gated access, and usage metrics.

**Architecture:** The gateway extends the existing `mcpClientsManager` by adding a preset layer that filters and virtualizes tool catalogs. Each preset becomes a virtual MCP server endpoint (HTTP/SSE or stdio) that proxies tool calls to underlying physical servers, enabling shareable URLs like `pulse.tootie.tv/mcp/<user>/<slug>` with per-tool toggles and access controls.

**Tech Stack:** PostgreSQL (Drizzle ORM), @modelcontextprotocol/sdk, Better Auth, Redis caching, Next.js 15 App Router, TypeScript strict mode, TDD with Jest

---

## Phase 1: Foundation & Schema

### Task 1: Database Schema - Gateway Presets Core

**Context:** We need 4 new PostgreSQL tables to support the gateway system. These tables will store preset configurations, server associations, access controls, and metrics. The schema builds on existing patterns from McpServerTable and McpToolCustomizationTable.

**Files:**
- Create: `src/lib/db/pg/migrations/0001_add_gateway_presets.sql`
- Modify: `src/lib/db/pg/schema.pg.ts:300` (after Mc pOAuthSessionTable)
- Create: `src/lib/db/pg/repositories/gateway-preset-repository.pg.ts`
- Test: `tests/lib/db/pg/repositories/gateway-preset-repository.pg.test.ts`

**Step 1: Write failing test for preset repository**

Create test file with basic CRUD operations:

```typescript
// tests/lib/db/pg/repositories/gateway-preset-repository.pg.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import { pgGatewayPresetRepository } from '@/lib/db/pg/repositories/gateway-preset-repository.pg';
import { generateUUID } from '@/lib/utils';

describe('Gateway Preset Repository', () => {
  const testUserId = generateUUID();

  it('should create a new gateway preset', async () => {
    const preset = await pgGatewayPresetRepository.create({
      userId: testUserId,
      slug: 'my-ai-toolkit',
      name: 'My AI Toolkit',
      description: 'Custom MCP preset for AI tasks',
      visibility: 'private',
    });

    expect(preset.id).toBeDefined();
    expect(preset.slug).toBe('my-ai-toolkit');
    expect(preset.visibility).toBe('private');
  });

  it('should enforce unique slug per user', async () => {
    await pgGatewayPresetRepository.create({
      userId: testUserId,
      slug: 'toolkit',
      name: 'Toolkit 1',
    });

    await expect(
      pgGatewayPresetRepository.create({
        userId: testUserId,
        slug: 'toolkit',
        name: 'Toolkit 2',
      })
    ).rejects.toThrow();
  });

  it('should find preset by slug', async () => {
    const created = await pgGatewayPresetRepository.create({
      userId: testUserId,
      slug: 'findme',
      name: 'Find Me',
    });

    const found = await pgGatewayPresetRepository.findBySlug(testUserId, 'findme');
    expect(found?.id).toBe(created.id);
  });

  it('should list all presets for user', async () => {
    await pgGatewayPresetRepository.create({
      userId: testUserId,
      slug: 'preset1',
      name: 'Preset 1',
    });

    await pgGatewayPresetRepository.create({
      userId: testUserId,
      slug: 'preset2',
      name: 'Preset 2',
    });

    const presets = await pgGatewayPresetRepository.findAllForUser(testUserId);
    expect(presets.length).toBeGreaterThanOrEqual(2);
  });

  it('should add server to preset', async () => {
    const preset = await pgGatewayPresetRepository.create({
      userId: testUserId,
      slug: 'with-server',
      name: 'With Server',
    });

    const serverId = generateUUID();
    await pgGatewayPresetRepository.addServer(
      preset.id,
      serverId,
      ['tool-a', 'tool-b']
    );

    const servers = await pgGatewayPresetRepository.getPresetServers(preset.id);
    expect(servers).toHaveLength(1);
    expect(servers[0].mcpServerId).toBe(serverId);
    expect(servers[0].allowedToolNames).toEqual(['tool-a', 'tool-b']);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test tests/lib/db/pg/repositories/gateway-preset-repository.pg.test.ts
```

Expected output: Tests FAIL with "Cannot find module '@/lib/db/pg/repositories/gateway-preset-repository.pg'"

**Step 3: Add schema definitions to schema.pg.ts**

Locate line ~300 (after `McpOAuthSessionTable`) and add:

```typescript
export const McpGatewayPresetTable = pgTable(
  'mcp_gateway_presets',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => UserTable.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    visibility: varchar('visibility', {
      enum: ['public', 'private', 'invite_only'],
    })
      .notNull()
      .default('private'),
    status: varchar('status', {
      enum: ['active', 'disabled', 'archived'],
    })
      .notNull()
      .default('active'),
    metadata: json('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    unique().on(table.userId, table.slug),
    index('gateway_preset_user_id_idx').on(table.userId),
    index('gateway_preset_slug_idx').on(table.slug),
    index('gateway_preset_visibility_idx').on(table.visibility),
  ]
);

export const McpGatewayPresetServerTable = pgTable(
  'mcp_gateway_preset_servers',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    presetId: uuid('preset_id')
      .notNull()
      .references(() => McpGatewayPresetTable.id, { onDelete: 'cascade' }),
    mcpServerId: uuid('mcp_server_id')
      .notNull()
      .references(() => McpServerTable.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(true),
    allowedToolNames: json('allowed_tool_names')
      .$type<string[]>()
      .default([]),
    createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    unique().on(table.presetId, table.mcpServerId),
    index('gateway_preset_server_preset_id_idx').on(table.presetId),
  ]
);

export const McpGatewayPresetAclTable = pgTable(
  'mcp_gateway_preset_acl',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    presetId: uuid('preset_id')
      .notNull()
      .references(() => McpGatewayPresetTable.id, { onDelete: 'cascade' }),
    principalType: varchar('principal_type', {
      enum: ['user', 'email', 'role'],
    }).notNull(),
    principalValue: text('principal_value').notNull(),
    role: varchar('role', {
      enum: ['viewer', 'editor', 'admin'],
    })
      .notNull()
      .default('viewer'),
    createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    unique().on(table.presetId, table.principalType, table.principalValue),
    index('gateway_preset_acl_preset_id_idx').on(table.presetId),
  ]
);

export const McpGatewayMetricsTable = pgTable(
  'mcp_gateway_metrics',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    presetId: uuid('preset_id')
      .notNull()
      .references(() => McpGatewayPresetTable.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', {
      enum: ['tool_call', 'tool_error', 'auth_success', 'auth_failure'],
    }).notNull(),
    toolName: text('tool_name'),
    mcpServerId: uuid('mcp_server_id'),
    latencyMs: json('latency_ms').$type<number>(),
    status: varchar('status', { enum: ['success', 'error'] }),
    errorMessage: text('error_message'),
    metadata: json('metadata').$type<Record<string, unknown>>(),
    timestamp: timestamp('timestamp').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('gateway_metrics_preset_id_idx').on(table.presetId),
    index('gateway_metrics_timestamp_idx').on(table.timestamp),
    index('gateway_metrics_event_type_idx').on(table.eventType),
  ]
);
```

**Step 4: Create SQL migration file**

Create `src/lib/db/pg/migrations/0001_add_gateway_presets.sql`:

```sql
-- MCP Gateway Presets Core Tables
CREATE TABLE IF NOT EXISTS mcp_gateway_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  visibility VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'invite_only')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'archived')),
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_slug UNIQUE (user_id, slug)
);

CREATE INDEX gateway_preset_user_id_idx ON mcp_gateway_presets(user_id);
CREATE INDEX gateway_preset_slug_idx ON mcp_gateway_presets(slug);
CREATE INDEX gateway_preset_visibility_idx ON mcp_gateway_presets(visibility);

-- MCP Gateway Preset Server Associations
CREATE TABLE IF NOT EXISTS mcp_gateway_preset_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id UUID NOT NULL REFERENCES mcp_gateway_presets(id) ON DELETE CASCADE,
  mcp_server_id UUID NOT NULL REFERENCES mcp_server(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  allowed_tool_names JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_preset_server UNIQUE (preset_id, mcp_server_id)
);

CREATE INDEX gateway_preset_server_preset_id_idx ON mcp_gateway_preset_servers(preset_id);

-- MCP Gateway Preset Access Control List
CREATE TABLE IF NOT EXISTS mcp_gateway_preset_acl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id UUID NOT NULL REFERENCES mcp_gateway_presets(id) ON DELETE CASCADE,
  principal_type VARCHAR(20) NOT NULL CHECK (principal_type IN ('user', 'email', 'role')),
  principal_value TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'admin')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_preset_acl UNIQUE (preset_id, principal_type, principal_value)
);

CREATE INDEX gateway_preset_acl_preset_id_idx ON mcp_gateway_preset_acl(preset_id);

-- MCP Gateway Metrics
CREATE TABLE IF NOT EXISTS mcp_gateway_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id UUID NOT NULL REFERENCES mcp_gateway_presets(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('tool_call', 'tool_error', 'auth_success', 'auth_failure')),
  tool_name TEXT,
  mcp_server_id UUID,
  latency_ms JSONB,
  status VARCHAR(20) CHECK (status IN ('success', 'error')),
  error_message TEXT,
  metadata JSONB,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX gateway_metrics_preset_id_idx ON mcp_gateway_metrics(preset_id);
CREATE INDEX gateway_metrics_timestamp_idx ON mcp_gateway_metrics(timestamp);
CREATE INDEX gateway_metrics_event_type_idx ON mcp_gateway_metrics(event_type);
```

**Step 5: Run migration (requires DB access)**

```bash
# Get database credentials from .env
psql -U <user> -d <database> -f src/lib/db/pg/migrations/0001_add_gateway_presets.sql
```

Expected: All 4 tables created successfully with indexes

**Step 6: Implement repository**

Create `src/lib/db/pg/repositories/gateway-preset-repository.pg.ts`:

```typescript
import { pgDb as db } from '../db.pg';
import {
  McpGatewayPresetTable,
  McpGatewayPresetServerTable,
  McpGatewayPresetAclTable,
  UserTable,
} from '../schema.pg';
import { eq, and, or, desc } from 'drizzle-orm';
import { generateUUID } from '@/lib/utils';

export interface GatewayPresetCreate {
  userId: string;
  slug: string;
  name: string;
  description?: string;
  visibility?: 'public' | 'private' | 'invite_only';
  status?: 'active' | 'disabled' | 'archived';
  metadata?: Record<string, unknown>;
}

export interface GatewayPresetUpdate {
  name?: string;
  description?: string;
  visibility?: 'public' | 'private' | 'invite_only';
  status?: 'active' | 'disabled' | 'archived';
  metadata?: Record<string, unknown>;
}

export const pgGatewayPresetRepository = {
  async create(data: GatewayPresetCreate) {
    const [preset] = await db
      .insert(McpGatewayPresetTable)
      .values({
        id: generateUUID(),
        userId: data.userId,
        slug: data.slug,
        name: data.name,
        description: data.description,
        visibility: data.visibility ?? 'private',
        status: data.status ?? 'active',
        metadata: data.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return preset;
  },

  async findById(id: string) {
    const [preset] = await db
      .select()
      .from(McpGatewayPresetTable)
      .where(eq(McpGatewayPresetTable.id, id));

    return preset;
  },

  async findBySlug(userId: string, slug: string) {
    const [preset] = await db
      .select()
      .from(McpGatewayPresetTable)
      .where(
        and(
          eq(McpGatewayPresetTable.userId, userId),
          eq(McpGatewayPresetTable.slug, slug)
        )
      );

    return preset;
  },

  async findAllForUser(userId: string) {
    const presets = await db
      .select()
      .from(McpGatewayPresetTable)
      .where(eq(McpGatewayPresetTable.userId, userId))
      .orderBy(desc(McpGatewayPresetTable.createdAt));

    return presets;
  },

  async findPublicPresets() {
    const presets = await db
      .select({
        id: McpGatewayPresetTable.id,
        userId: McpGatewayPresetTable.userId,
        slug: McpGatewayPresetTable.slug,
        name: McpGatewayPresetTable.name,
        description: McpGatewayPresetTable.description,
        visibility: McpGatewayPresetTable.visibility,
        status: McpGatewayPresetTable.status,
        createdAt: McpGatewayPresetTable.createdAt,
        updatedAt: McpGatewayPresetTable.updatedAt,
        userName: UserTable.name,
        userAvatar: UserTable.image,
      })
      .from(McpGatewayPresetTable)
      .leftJoin(UserTable, eq(McpGatewayPresetTable.userId, UserTable.id))
      .where(
        and(
          eq(McpGatewayPresetTable.visibility, 'public'),
          eq(McpGatewayPresetTable.status, 'active')
        )
      )
      .orderBy(desc(McpGatewayPresetTable.createdAt));

    return presets;
  },

  async update(id: string, data: GatewayPresetUpdate) {
    const [preset] = await db
      .update(McpGatewayPresetTable)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(McpGatewayPresetTable.id, id))
      .returning();

    return preset;
  },

  async delete(id: string) {
    await db
      .delete(McpGatewayPresetTable)
      .where(eq(McpGatewayPresetTable.id, id));
  },

  async addServer(presetId: string, mcpServerId: string, allowedToolNames: string[] = []) {
    const [association] = await db
      .insert(McpGatewayPresetServerTable)
      .values({
        id: generateUUID(),
        presetId,
        mcpServerId,
        enabled: true,
        allowedToolNames,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [McpGatewayPresetServerTable.presetId, McpGatewayPresetServerTable.mcpServerId],
        set: {
          allowedToolNames,
          updatedAt: new Date(),
        },
      })
      .returning();

    return association;
  },

  async removeServer(presetId: string, mcpServerId: string) {
    await db
      .delete(McpGatewayPresetServerTable)
      .where(
        and(
          eq(McpGatewayPresetServerTable.presetId, presetId),
          eq(McpGatewayPresetServerTable.mcpServerId, mcpServerId)
        )
      );
  },

  async getPresetServers(presetId: string) {
    const servers = await db
      .select()
      .from(McpGatewayPresetServerTable)
      .where(eq(McpGatewayPresetServerTable.presetId, presetId));

    return servers;
  },

  async toggleServerEnabled(presetId: string, mcpServerId: string, enabled: boolean) {
    const [server] = await db
      .update(McpGatewayPresetServerTable)
      .set({ enabled, updatedAt: new Date() })
      .where(
        and(
          eq(McpGatewayPresetServerTable.presetId, presetId),
          eq(McpGatewayPresetServerTable.mcpServerId, mcpServerId)
        )
      )
      .returning();

    return server;
  },
};
```

**Step 7: Run tests to verify they pass**

```bash
pnpm test tests/lib/db/pg/repositories/gateway-preset-repository.pg.test.ts
```

Expected: All tests PASS (may need to adjust DB connection for test environment)

**Step 8: Commit**

```bash
git add src/lib/db/pg/schema.pg.ts \
  src/lib/db/pg/migrations/0001_add_gateway_presets.sql \
  src/lib/db/pg/repositories/gateway-preset-repository.pg.ts \
  tests/lib/db/pg/repositories/gateway-preset-repository.pg.test.ts
git commit -m "feat(gateway): add database schema and repository for gateway presets

- Add mcp_gateway_presets table with slug, visibility, status
- Add mcp_gateway_preset_servers for server/tool associations
- Add mcp_gateway_preset_acl for access control
- Add mcp_gateway_metrics for usage tracking
- Implement pgGatewayPresetRepository with CRUD operations
- Add comprehensive tests for preset repository

Migration file: 0001_add_gateway_presets.sql"
```

---

## Phase 2: Gateway Service & Tool Filtering

### Task 2: Gateway Service - Core Logic

**Context:** The GatewayService wraps `mcpClientsManager` and filters the tool catalog based on preset configuration. This is the heart of the virtual server concept.

**Files:**
- Create: `src/lib/ai/mcp/gateway/types.ts`
- Create: `src/lib/ai/mcp/gateway/gateway-service.ts`
- Test: `tests/lib/ai/mcp/gateway/gateway-service.test.ts`

[Continues with similar detailed step-by-step instructions for remaining tasks...]

---

## Execution Guide

### Prerequisites

1. PostgreSQL database access (for migrations)
2. Redis instance (for caching - can mock in tests)
3. Existing MCP servers configured in the system
4. Better Auth configured and working

### Running the Plan

**Option 1: Sequential Execution (Recommended for Learning)**

Execute each task one by one:
1. Complete all steps in Task 1
2. Verify tests pass
3. Commit
4. Move to Task 2
5. Repeat

**Option 2: Batch Execution with Checkpoints**

Use `superpowers:executing-plans` to run in batches:
- Phase 1 (Tasks 1-2): Foundation
- Phase 2 (Tasks 3-4): Virtual Server
- Phase 3 (Tasks 5-6): Management & Docs

After each phase, review code and run integration tests.

**Option 3: Parallel Development**

If working with multiple developers:
- Dev 1: Tasks 1-2 (Schema + Service)
- Dev 2: Tasks 3 (Caching)
- Dev 3: Tasks 4 (Gateway Server)
- Merge and integrate after each completes

### Testing Strategy

- **Unit Tests**: Every repository and service method
- **Integration Tests**: Full flow from API → Gateway → MCP Server
- **E2E Tests**: User creates preset via UI, shares link, recipient accesses tools

### Success Criteria

✅ Can create preset via API
✅ Can toggle individual tools per server
✅ Gateway endpoint returns filtered tool list
✅ Tool calls proxy to correct underlying servers
✅ Metrics recorded for all operations
✅ Cache invalidation works correctly
✅ Access control enforced (public/private/invite-only)

---

## Plan Summary

**Total Tasks:** 6 core tasks across 3 phases
**Estimated Time:** 16-20 developer hours
**Lines of Code:** ~2000 (including tests)
**Test Coverage Target:** 85%+

**Files Created:** 15+
**Files Modified:** 3-4
**Database Tables:** 4 new tables

**Technologies Used:**
- TypeScript (strict mode)
- Drizzle ORM
- @modelcontextprotocol/sdk
- Better Auth
- Redis (via createCache)
- Next.js App Router
- Jest + Testing Library

---

*Plan saved to: /tmp/mcp-gateway-implementation-plan.md*
*Please move to: docs/plans/2025-11-16-mcp-gateway.md when permissions allow*
