# Testing Patterns Research

## Summary
This codebase uses Vitest for unit tests and Playwright for E2E tests. Unit tests are heavily mocked with vi.mock(), using no real database connections. The repository pattern is mocked at the import level. Path aliases (@/, lib/, app-types/) are configured via vite-tsconfig-paths plugin.

## Key Components

### Test Framework Configuration
- `/compose/better-chatbot/vitest.config.ts`: Vitest config with vite-tsconfig-paths plugin for path resolution
- `/compose/better-chatbot/playwright.config.ts`: E2E test config with global setup/teardown
- `/compose/better-chatbot/tsconfig.json`: TypeScript path mappings (@/, lib/, app-types/, etc.)

### Example Test Files
- `/compose/better-chatbot/src/lib/ai/mcp/db-mcp-config-storage.test.ts`: Repository mocking pattern
- `/compose/better-chatbot/src/lib/admin/server.test.ts`: Full module mocking with permissions
- `/compose/better-chatbot/src/lib/user/server.test.ts`: Business logic testing with beforeEach/afterEach
- `/compose/better-chatbot/src/lib/ai/mcp/memory-mcp-config-storage.test.ts`: In-memory implementation testing
- `/compose/better-chatbot/src/lib/cache/safe-redis-cache.test.ts`: Mock chaining and fallback patterns

### Repository Files
- `/compose/better-chatbot/src/lib/db/repository.ts`: Central export point for all repositories
- `/compose/better-chatbot/src/lib/db/pg/repositories/mcp-repository.pg.ts`: Real PostgreSQL implementation using Drizzle ORM

### E2E Test Infrastructure
- `/compose/better-chatbot/tests/lifecycle/setup.global.ts`: Seeds test users before E2E tests
- `/compose/better-chatbot/tests/lifecycle/auth-states.setup.ts`: Creates auth states for different user roles
- `/compose/better-chatbot/tests/utils/test-helpers.ts`: Playwright helper utilities

## Implementation Patterns

### 1. Test File Structure (Vitest Unit Tests)
All unit tests use this pattern:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies BEFORE imports
vi.mock("lib/db/repository", () => ({
  mcpRepository: {
    selectAll: vi.fn(),
    save: vi.fn(),
    deleteById: vi.fn(),
    selectById: vi.fn(),
  },
}));

vi.mock("logger", () => ({
  default: {
    withDefaults: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

// Import mocked modules AFTER vi.mock
const mockMcpRepository = await import("lib/db/repository").then(
  (m) => m.mcpRepository,
);

describe("Feature Name", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Additional setup
  });

  afterEach(() => {
    // Cleanup if needed
  });

  it("should do something", async () => {
    vi.mocked(mockMcpRepository.selectAll).mockResolvedValue([mockData]);

    const result = await functionUnderTest();

    expect(result).toEqual(expected);
    expect(mockMcpRepository.selectAll).toHaveBeenCalledOnce();
  });
});
```

### 2. Repository Mocking Pattern
**NO REAL DATABASE** - All repository methods are mocked:

```typescript
// Mock the entire repository module
vi.mock("lib/db/repository", () => ({
  mcpRepository: {
    selectAll: vi.fn(),
    save: vi.fn(),
    deleteById: vi.fn(),
    selectById: vi.fn(),
  },
}));

// Import and use in tests
const mockRepo = await import("lib/db/repository").then(m => m.mcpRepository);

// Configure mock behavior
vi.mocked(mockRepo.save).mockResolvedValue(mockData);
vi.mocked(mockRepo.selectAll).mockRejectedValue(new Error("DB error"));
```

### 3. Async Test Patterns
Standard async/await with expect().rejects.toThrow():

```typescript
it("should throw error when save fails", async () => {
  vi.mocked(mockRepository.save).mockRejectedValue(
    new Error("Save failed")
  );

  await expect(
    storage.save(serverToSave)
  ).rejects.toThrow("Save failed");
});

it("should return data on success", async () => {
  vi.mocked(mockRepository.selectAll).mockResolvedValue([mockServer]);

  const result = await storage.loadAll();

  expect(result).toEqual([mockServer]);
});
```

### 4. Mock Chaining for Complex Dependencies
Example from create-mcp-clients-manager.test.ts:

```typescript
vi.mock("./create-mcp-client", () => ({
  createMCPClient: vi.fn(),
}));

vi.mock("ts-safe", () => ({
  safe: vi.fn((fn) => ({
    ifOk: vi.fn((anotherFn) => ({
      watch: vi.fn((watchFn) => ({
        unwrap: vi.fn(() => {
          fn();
          if (typeof anotherFn === "function") {
            return anotherFn();
          }
          watchFn();
        }),
      })),
    })),
  })),
}));

const mockCreateMCPClient = await import("./create-mcp-client").then(
  (m) => m.createMCPClient,
);

beforeEach(() => {
  vi.mocked(mockCreateMCPClient).mockReturnValue(mockClient);
});
```

### 5. Timer and Interval Testing
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers(); // Mock timers
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers(); // Restore real timers
});
```

### 6. Test Data Factories
Create helper functions for test data:

```typescript
const createTestServer = (name: string): McpServerInsert => ({
  name,
  userId: "test-user-id",
  config: {
    command: "test-command",
    args: ["--test"],
    env: { TEST: "true" },
  } as MCPStdioConfig,
});

// Use in tests
await storage.save(createTestServer("server1"));
```

### 7. E2E Test Pattern (Playwright)
```typescript
import { test, expect } from "@playwright/test";

test("should perform action", async ({ page }) => {
  await page.goto("/some-page");

  await page.getByTestId("some-button").click();

  await expect(page.getByTestId("result")).toBeVisible();
});
```

## Considerations

### Path Resolution
- **Vitest**: Uses `vite-tsconfig-paths` plugin to resolve TypeScript paths
- **Import paths**: Use aliases like `lib/`, `app-types/`, `@/`, `auth/`, `logger`
- **No relative imports needed**: Can use `import { x } from "lib/db/repository"` instead of `../../lib/db/repository`

### No Test Database
- **Unit tests**: All database operations are mocked with vi.mock()
- **No beforeEach DB cleanup**: Not needed since no real DB is used
- **Test isolation**: Each test configures its own mock responses
- **E2E tests**: Use real database seeded via scripts/seed-test-users.ts

### Mock Execution Order
1. Call `vi.mock()` BEFORE any imports
2. Import mocked modules AFTER mocks are defined
3. Use `await import()` to get mocked instances
4. Configure with `vi.mocked()` in beforeEach or test

### Common Gotchas
- **server-only module**: Must be mocked in server-side tests: `vi.mock("server-only", () => ({}))`
- **next/headers**: Mock with Headers(): `vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))`
- **logger**: Always mock the logger module
- **clearAllMocks**: Always call in beforeEach to prevent test pollution

### Test Utilities Available
- `/compose/better-chatbot/tests/utils/test-helpers.ts`: Playwright-specific helpers (uniqueTestName, clickAndWaitForNavigation, etc.)
- No shared Vitest utilities found - each test file is self-contained

### Verification Patterns
```typescript
// Function called once
expect(mockFn).toHaveBeenCalledOnce();

// Function called with specific args
expect(mockFn).toHaveBeenCalledWith(expectedArgs);

// Function NOT called
expect(mockFn).not.toHaveBeenCalled();

// Partial object matching
expect(result).toEqual(expect.objectContaining({ id: "123" }));

// Multiple assertions
expect(result).toMatchObject({ name: "test", enabled: true });
```

## Next Steps

### To Write Repository Tests:
1. Create test file: `src/lib/db/pg/repositories/[name]-repository.pg.test.ts`
2. Mock the database instance (drizzle): `vi.mock("../db.pg")`
3. Mock any dependencies (logger, utils, etc.)
4. Import repository after mocks
5. Write tests for each method using mocked db responses
6. No real database setup needed

### Example Repository Test Structure:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("../db.pg", () => ({
  pgDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("logger", () => ({
  default: { error: vi.fn(), debug: vi.fn() },
}));

const mockDb = await import("../db.pg").then(m => m.pgDb);
import { pgMcpRepository } from "./mcp-repository.pg";

describe("MCP Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should save server", async () => {
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockServer]),
        }),
      }),
    });

    vi.mocked(mockDb.insert).mockReturnValue(mockInsert() as any);

    const result = await pgMcpRepository.save(serverData);

    expect(result).toEqual(mockServer);
  });
});
```

### Integration Test Approach (if needed):
- Use Playwright for full integration tests with real database
- Seed test data in global setup: `tests/lifecycle/setup.global.ts`
- Clean up in teardown: `tests/lifecycle/teardown.global.ts`
- Access real database via E2E test utilities
