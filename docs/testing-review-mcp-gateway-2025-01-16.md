# Testing Review: MCP Gateway Implementation Plan
**Date:** 2025-01-16
**Reviewer:** Claude Code (Test Automation Expert)
**Plan:** `docs/plans/2025-01-16-mcp-gateway-complete.md`

---

## Executive Summary

**Overall Assessment:** GOOD with areas for improvement

The testing approach demonstrates solid TDD adherence with RED-GREEN-REFACTOR cycles throughout. Each task follows the pattern of writing failing tests first, implementing minimal code, and then verifying. The plan includes unit, integration, and E2E tests with appropriate mocking strategies using Vitest patterns.

**Key Strengths:**
- Consistent TDD methodology across all tasks
- Good separation of concerns (unit vs integration vs E2E)
- Proper use of Vitest mocking patterns
- Test isolation with beforeEach cleanup
- Descriptive test names following "should" convention

**Key Weaknesses:**
- Missing concurrent access and race condition tests
- Insufficient cache invalidation verification
- Limited metrics recording validation
- No performance/timeout testing
- Missing error edge cases (network failures, DB rollbacks)
- No test coverage for malicious inputs (SQL injection, XSS)

**Recommendation:** Implement the plan as-is, but add supplementary tests for concurrency, security, and metrics validation before production.

---

## 1. Test Coverage Analysis

### 1.1 Critical Paths Covered

**Repository Layer (Phase 1, Task 1):**
- ✅ Create gateway preset
- ✅ Validate slug format
- ✅ Find preset by slug
- ✅ Add server to preset
- ✅ Validate empty allowedToolNames (all tools allowed)

**Service Layer (Phase 1, Task 2):**
- ✅ Filter tools by allowed tool names
- ✅ Return all tools when allowedToolNames is empty
- ✅ Return empty when server is disabled
- ✅ Return empty when preset status is not active
- ✅ Validate preset configuration
- ✅ Detect invalid server IDs in config

**Cache Layer (Phase 2, Task 3):**
- ✅ Cache preset configuration with TTL
- ✅ Retrieve cached preset configuration
- ✅ Return null for cache miss
- ✅ Invalidate preset with pattern deletion
- ✅ Cache tool catalog with default TTL
- ✅ Handle cache errors gracefully

**HTTP/JSON-RPC Endpoint (Phase 2, Task 4):**
- ✅ Return 404 for non-existent preset
- ✅ Return 403 for private preset without auth
- ✅ Handle tools/list request
- ✅ Handle GET request for metadata
- ✅ Handle tools/call request (implied)

**Management APIs (Phase 3, Task 5):**
- ✅ Require authentication for listing presets
- ✅ List user presets
- ✅ Create preset with validation
- ✅ Update preset
- ✅ Delete preset
- ✅ Return 404 for non-existent preset updates

**E2E Integration (Phase 3, Task 6):**
- ✅ Complete workflow: create → update → list → delete
- ✅ Access control (public vs private presets)
- ✅ Input validation (slug format, duplicates)
- ✅ Cache invalidation on updates
- ✅ JSON-RPC tools/list endpoint
- ✅ Metadata GET endpoint

### 1.2 Edge Cases Covered

**Good Coverage:**
- ✅ Invalid slug format (`Invalid Slug!`)
- ✅ Empty allowedToolNames (meaning all tools allowed)
- ✅ Disabled servers (should return empty)
- ✅ Inactive preset status (should return empty)
- ✅ Invalid server IDs in configuration
- ✅ Cache miss scenarios
- ✅ Cache error handling (graceful degradation)
- ✅ Duplicate slug per user (409 conflict)
- ✅ Unauthenticated access to private presets (403)

**Missing Coverage:**
- ❌ Concurrent preset creation with same slug (race condition)
- ❌ Cache invalidation during concurrent updates
- ❌ Maximum slug length boundary (max 50 chars)
- ❌ Special characters in JSON-RPC params
- ❌ Very large tool catalogs (pagination/truncation)
- ❌ Malformed JSON-RPC requests (invalid jsonrpc version, missing id)
- ❌ Tool execution timeouts
- ❌ Partial server failure (some servers down, others up)
- ❌ Database connection failures
- ❌ Cache connection failures (Redis down)

### 1.3 Error Handling Coverage

**Good Coverage:**
- ✅ 404 responses for missing presets
- ✅ 403 responses for unauthorized access
- ✅ 400 responses for validation errors
- ✅ 409 responses for conflicts (duplicate slug)
- ✅ Cache error graceful degradation (returns null)
- ✅ JSON-RPC error codes (-32601 method not found, -32603 internal error)
- ✅ Tool call error metrics recording

**Missing Coverage:**
- ❌ Database transaction rollback scenarios
- ❌ Network timeout errors from MCP servers
- ❌ Partial metrics recording failures (should not block main flow)
- ❌ JSON-RPC parse errors (malformed JSON)
- ❌ Tool execution errors with detailed error data
- ❌ Rate limiting scenarios (429 Too Many Requests)
- ❌ 500 internal server errors with proper logging
- ❌ Retry logic for transient failures

### 1.4 Coverage Gaps

**Critical Gaps:**

1. **Concurrency and Race Conditions:**
   - No tests for simultaneous preset creation with same slug
   - No tests for concurrent cache invalidation
   - No tests for parallel tool calls to same preset
   - No tests for simultaneous server addition/removal

2. **Metrics Recording Validation:**
   - Tests verify metrics are recorded but don't validate correctness
   - No tests for metrics aggregation accuracy
   - No tests for metrics storage failures (should not block tool calls)
   - No tests for metrics query performance with large datasets

3. **Security Testing:**
   - No SQL injection tests (slug, name, description fields)
   - No XSS tests in metadata responses
   - No CSRF protection tests for management APIs
   - No rate limiting tests
   - No OAuth token validation edge cases

4. **Performance Testing:**
   - No timeout tests for slow tool execution
   - No tests for large tool catalogs (100+ tools)
   - No tests for cache expiration under load
   - No tests for database query performance

5. **Cache Invalidation:**
   - Tests verify invalidation is called but not that it works correctly
   - No tests for cache invalidation failures (should still update DB)
   - No tests for eventual consistency scenarios
   - No tests for cache stampede prevention

---

## 2. Test Quality Analysis

### 2.1 Mocking Strategy

**Strengths:**
- ✅ Proper use of Vitest `vi.mock()` at module level
- ✅ Dynamic imports after mocking to avoid cache issues
- ✅ Mock chaining for Drizzle ORM methods (`insert().values().returning()`)
- ✅ Consistent `beforeEach` cleanup with `vi.clearAllMocks()`
- ✅ Type-safe mocks with TypeScript imports

**Concerns:**
- ⚠️ Over-mocking in some tests (mocking entire database reduces confidence)
- ⚠️ No verification of mock call arguments in some tests
- ⚠️ Some tests mock too many layers (e.g., mocking repo, cache, AND service)
- ⚠️ JSON-RPC tests mock cache but not actual tool execution

**Recommendations:**
1. Add integration tests with real database (use test DB or in-memory SQLite)
2. Verify mock call arguments with `expect(mockFn).toHaveBeenCalledWith(...)`
3. Consider using partial mocks for service layer tests (mock DB, use real cache)
4. Add contract tests to validate mock behavior matches real implementation

### 2.2 Test Isolation

**Strengths:**
- ✅ Each test clears mocks in `beforeEach`
- ✅ Tests don't share state between runs
- ✅ Mock data is recreated per test
- ✅ E2E tests include cleanup steps (delete created presets)

**Concerns:**
- ⚠️ E2E tests may leave data behind if assertions fail before cleanup
- ⚠️ No database reset between E2E test runs (could cause flakiness)
- ⚠️ Cache is not explicitly cleared between tests

**Recommendations:**
1. Use `afterEach` in E2E tests to guarantee cleanup even on failure
2. Add database transaction rollback in integration tests
3. Clear cache in `beforeEach` for cache-related tests
4. Use unique IDs (timestamps, UUIDs) in E2E tests to avoid conflicts

### 2.3 Assertion Quality

**Strengths:**
- ✅ Specific assertions (`expect(result.slug).toBe('my-toolkit')`)
- ✅ Multiple assertions per test verify complete behavior
- ✅ Type-safe expectations with TypeScript
- ✅ HTTP status code assertions in API tests
- ✅ Response structure validation (toolCount, servers, etc.)

**Areas for Improvement:**
- ⚠️ Some tests only check existence, not values (`expect(filtered['filesystem_read_file']).toBeDefined()`)
- ⚠️ Missing negative assertions (e.g., `expect(filtered['blocked_tool']).toBeUndefined()`)
- ⚠️ No schema validation for complex response objects
- ⚠️ Missing assertions for side effects (cache invalidation, metrics recording)

**Recommendations:**
1. Add Zod schema validation in API tests (`expect(data).toMatchSchema(PresetSchema)`)
2. Assert on filtered-out items, not just included items
3. Verify mock call counts (`expect(mockCache.set).toHaveBeenCalledTimes(1)`)
4. Add snapshot tests for complex response structures

### 2.4 Test Naming

**Strengths:**
- ✅ Follows "should" convention consistently
- ✅ Descriptive names explain expected behavior
- ✅ Good use of describe blocks for grouping
- ✅ Names include context (e.g., "when allowedToolNames is empty")

**Minor Issues:**
- ⚠️ Some names are generic (`should create a new gateway preset`)
- ⚠️ Missing Given-When-Then context in some names

**Recommendations:**
1. Add context to generic names: `should create private preset with default status active`
2. Use Given-When-Then in complex scenarios: `given disabled server, when filtering tools, should return empty`
3. Group related tests with nested describe blocks

---

## 3. Test Strategy Analysis

### 3.1 Unit vs Integration vs E2E Mix

**Distribution:**
- **Unit Tests:** ~60% (repository, service, cache)
- **Integration Tests:** ~30% (API routes with mocked DB)
- **E2E Tests:** ~10% (Playwright with real DB)

**Assessment:** GOOD - Follows test pyramid with more unit tests than integration/E2E

**Strengths:**
- ✅ Fast feedback loop with unit tests
- ✅ Integration tests verify API contracts
- ✅ E2E tests cover critical user flows
- ✅ Each layer tests different concerns

**Recommendations:**
1. Add more integration tests between layers (service + cache, repo + DB)
2. Increase E2E coverage for error scenarios (auth failures, invalid data)
3. Consider component tests for complex business logic

### 3.2 Integration Between Layers

**Good Coverage:**
- ✅ Service → Cache integration (cache hits/misses)
- ✅ Service → Repository integration (preset lookup)
- ✅ API Route → Service integration (tool filtering)
- ✅ E2E tests verify full stack integration

**Missing:**
- ❌ Repository → Database integration (real DB queries)
- ❌ Cache → MemoryCache integration (real cache operations)
- ❌ Service → mcpClientsManager integration (real tool calls)
- ❌ Metrics recording → Database integration (verify metrics in DB)

**Recommendations:**
1. Add integration tests with real PostgreSQL database (use Docker container)
2. Add integration tests with real MemoryCache (verify TTL, pattern deletion)
3. Add integration tests with mock MCP server (verify tool proxying)
4. Add integration tests for metrics pipeline (record → query → aggregate)

### 3.3 E2E Scenario Coverage

**Covered Scenarios:**
- ✅ Happy path: create → update → list → delete
- ✅ Access control: public vs private presets
- ✅ Validation: slug format, duplicate detection
- ✅ Cache behavior: invalidation on updates

**Missing Scenarios:**
- ❌ Multi-user collaboration (user A shares preset with user B)
- ❌ Tool execution end-to-end (call tool, get result)
- ❌ Server connection failures (MCP server down)
- ❌ Long-running tool executions (timeouts)
- ❌ Concurrent user operations (user A and B edit same preset)
- ❌ OAuth flow integration (login → create preset → share)
- ❌ Metrics dashboard workflow (create preset → use tools → view metrics)

**Recommendations:**
1. Add E2E test for complete tool execution: create preset → call tool → verify result → check metrics
2. Add E2E test for sharing workflow: user A creates → user B accesses → verify permissions
3. Add E2E test for concurrent operations: parallel preset creation, updates
4. Add E2E test for failure recovery: tool fails → retry → success

### 3.4 Vitest Mocking Pattern

**Pattern Used:**
```typescript
vi.mock('@/lib/db/pg/db.pg', () => ({
  pgDb: {
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

beforeEach(async () => {
  vi.clearAllMocks();
  const dbModule = await import('@/lib/db/pg/db.pg');
  mockDb = dbModule.pgDb;
});
```

**Assessment:** CORRECT - Follows Vitest best practices

**Strengths:**
- ✅ Module-level mocking prevents import caching issues
- ✅ Dynamic imports ensure mocks are applied
- ✅ clearAllMocks prevents test pollution
- ✅ Type-safe with TypeScript inference

**Concerns:**
- ⚠️ Verbose boilerplate repeated in every test file
- ⚠️ Mock setup can drift from real implementation

**Recommendations:**
1. Extract common mock setup to test utilities (`setupMocks()` helper)
2. Add contract tests to verify mocks match real implementation
3. Consider using `vi.mocked()` utility for type-safe mock access
4. Document mock patterns in testing guide

---

## 4. TDD Adherence Analysis

### 4.1 RED-GREEN-REFACTOR Cycle

**Evidence from Plan:**

**Task 1 - Repository:**
1. **RED:** Write failing test → `Cannot find module` error ✅
2. **GREEN:** Implement repository → tests pass ✅
3. **REFACTOR:** Extract validation logic ✅

**Task 2 - Service:**
1. **RED:** Write failing test → module not found ✅
2. **GREEN:** Implement GatewayService → tests pass ✅
3. **REFACTOR:** Clean up tool filtering logic ✅

**Task 3 - Cache:**
1. **RED:** Write failing test → module not found ✅
2. **GREEN:** Implement GatewayCache → tests pass ✅
3. **REFACTOR:** Add deletePattern to interface ✅

**Assessment:** EXCELLENT - Consistent TDD throughout all tasks

### 4.2 Test-First Evidence

**Strengths:**
- ✅ Every task starts with "Step 1: Write failing test"
- ✅ Tests written before implementation in all cases
- ✅ Expected failure output documented
- ✅ Implementation is minimal to pass tests

**Verification:**
- ✅ Test files created before implementation files
- ✅ Tests verify expected behavior before code exists
- ✅ No "test after implementation" pattern detected

### 4.3 Failing Test Verification

**Strengths:**
- ✅ Expected error messages documented (`Cannot find module`)
- ✅ Tests verify correct failure reason
- ✅ Plan includes "Step 2: Run test to verify it fails"

**Missing:**
- ⚠️ No verification that tests fail for RIGHT reason
- ⚠️ No tests for false positives (tests that always pass)
- ⚠️ No mutation testing to verify test quality

**Recommendations:**
1. Add step to verify test fails with EXPECTED error (not syntax error)
2. Add mutation testing to verify tests catch bugs
3. Add comment in test explaining expected failure mode

### 4.4 TDD Cycle Metrics (Not in Plan)

**Missing from Plan:**
- ❌ No cycle time tracking (RED → GREEN → REFACTOR duration)
- ❌ No test growth rate metrics
- ❌ No code-to-test ratio tracking
- ❌ No TDD compliance dashboard

**Recommendations:**
1. Add Git hooks to track commit patterns (test commit before impl commit)
2. Add metrics to CI/CD (test coverage, cycle time)
3. Add TDD compliance checks (fail if code commits without test commits)

---

## 5. Missing Tests - Detailed Analysis

### 5.1 Concurrent Access Patterns

**Critical Missing Tests:**

**Test 1: Concurrent Preset Creation (Race Condition)**
```typescript
it('should prevent duplicate slug on concurrent creation', async () => {
  const data = { userId: 'user-1', slug: 'shared', name: 'Test' };

  // Simulate two concurrent creates
  const [result1, result2] = await Promise.allSettled([
    pgGatewayPresetRepository.create(data),
    pgGatewayPresetRepository.create(data),
  ]);

  // One should succeed, one should fail with conflict
  const succeeded = [result1, result2].filter(r => r.status === 'fulfilled');
  const failed = [result1, result2].filter(r => r.status === 'rejected');

  expect(succeeded).toHaveLength(1);
  expect(failed).toHaveLength(1);
  expect(failed[0].reason.message).toContain('already exists');
});
```

**Test 2: Concurrent Cache Invalidation**
```typescript
it('should handle concurrent cache invalidation safely', async () => {
  const cache = new GatewayCache();
  await cache.setPresetConfig('test', mockConfig);

  // Simulate multiple invalidations
  await Promise.all([
    cache.invalidatePreset('test'),
    cache.invalidatePreset('test'),
    cache.invalidatePreset('test'),
  ]);

  // Should not throw errors
  const result = await cache.getPresetConfig('test');
  expect(result).toBeNull();
});
```

**Test 3: Parallel Tool Calls**
```typescript
it('should handle parallel tool calls without race conditions', async () => {
  const service = new GatewayService(mcpClientsManager);

  // Simulate 10 concurrent tool calls
  const calls = Array.from({ length: 10 }, (_, i) =>
    service.executeToolCall(config, `tool-${i}`, {})
  );

  const results = await Promise.all(calls);

  // All should succeed independently
  expect(results).toHaveLength(10);
  results.forEach(r => expect(r.status).toBe('success'));
});
```

### 5.2 Cache Invalidation Verification

**Test 4: Verify Cache Invalidation Works**
```typescript
it('should actually invalidate cache on update', async () => {
  // Set initial cache
  await cache.setPresetConfig('test', { name: 'Original' });

  // Update preset (triggers invalidation)
  await pgGatewayPresetRepository.update('preset-id', { name: 'Updated' });

  // Verify cache is cleared (not just that invalidate was called)
  const cached = await cache.getPresetConfig('test');
  expect(cached).toBeNull(); // or expect fresh data from DB
});
```

**Test 5: Cache Invalidation Failure Doesn't Block Update**
```typescript
it('should update database even if cache invalidation fails', async () => {
  mockCache.invalidatePreset.mockRejectedValue(new Error('Redis down'));

  // Update should still succeed
  const result = await pgGatewayPresetRepository.update('id', { name: 'New' });

  expect(result.name).toBe('New');
  // Verify DB was updated
  const fromDb = await pgGatewayPresetRepository.findById('id');
  expect(fromDb.name).toBe('New');
});
```

### 5.3 Metrics Recording Validation

**Test 6: Verify Metrics Accuracy**
```typescript
it('should record accurate latency metrics', async () => {
  const startTime = Date.now();

  // Simulate tool call with known duration
  await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay

  const latency = Date.now() - startTime;
  await pgGatewayMetricsRepository.recordToolCall({
    presetId: 'test',
    toolName: 'tool-1',
    latencyMs: latency,
    status: 'success',
  });

  // Verify metric was stored correctly
  const metrics = await pgGatewayMetricsRepository.getRecentMetrics('test');
  expect(metrics[0].latencyMs).toBeGreaterThanOrEqual(100);
  expect(metrics[0].latencyMs).toBeLessThan(200); // reasonable threshold
});
```

**Test 7: Metrics Recording Doesn't Block Tool Calls**
```typescript
it('should not block tool calls if metrics recording fails', async () => {
  mockMetricsRepo.recordToolCall.mockRejectedValue(new Error('DB down'));

  // Tool call should still succeed
  const result = await service.executeToolCall(config, 'tool-1', {});

  expect(result.status).toBe('success');
  // Verify error was logged but not thrown
  expect(mockLogger.error).toHaveBeenCalledWith(
    expect.stringContaining('Failed to record metrics')
  );
});
```

### 5.4 Security Testing

**Test 8: SQL Injection Prevention**
```typescript
it('should prevent SQL injection in slug parameter', async () => {
  const maliciousSlug = "test'; DROP TABLE gateway_presets; --";

  await expect(
    pgGatewayPresetRepository.create({
      userId: 'user-1',
      slug: maliciousSlug,
      name: 'Test',
    })
  ).rejects.toThrow('Invalid slug format');

  // Verify table still exists
  const presets = await pgGatewayPresetRepository.findAllForUser('user-1');
  expect(presets).toBeDefined(); // Would fail if table was dropped
});
```

**Test 9: XSS Prevention in Metadata**
```typescript
it('should sanitize XSS in preset name and description', async () => {
  const xssName = '<script>alert("XSS")</script>';
  const xssDesc = '<img src=x onerror=alert("XSS")>';

  const preset = await pgGatewayPresetRepository.create({
    userId: 'user-1',
    slug: 'xss-test',
    name: xssName,
    description: xssDesc,
  });

  // Verify metadata endpoint escapes HTML
  const metadata = await service.getGatewayMetadata(preset);
  expect(metadata.name).not.toContain('<script>');
  expect(metadata.description).not.toContain('<img');
});
```

**Test 10: Rate Limiting**
```typescript
it('should enforce rate limits on tool calls', async () => {
  const calls = Array.from({ length: 101 }, () =>
    fetch('/api/mcp/gateway/test/tools/call', {
      method: 'POST',
      body: JSON.stringify({ toolName: 'test' }),
    })
  );

  const results = await Promise.all(calls);
  const rateLimited = results.filter(r => r.status === 429);

  expect(rateLimited.length).toBeGreaterThan(0);
});
```

### 5.5 Performance and Timeout Testing

**Test 11: Tool Execution Timeout**
```typescript
it('should timeout slow tool executions', async () => {
  const slowTool = vi.fn(() =>
    new Promise(resolve => setTimeout(resolve, 60000)) // 60 second delay
  );

  mockMcpManager.tools.mockResolvedValue({
    'slow_tool': { execute: slowTool },
  });

  await expect(
    service.executeToolCall(config, 'slow_tool', {}, { timeout: 5000 })
  ).rejects.toThrow('Tool execution timeout');
});
```

**Test 12: Large Tool Catalog Performance**
```typescript
it('should handle large tool catalogs efficiently', async () => {
  // Generate 1000 tools
  const largeCatalog = Object.fromEntries(
    Array.from({ length: 1000 }, (_, i) => [
      `tool_${i}`,
      { description: `Tool ${i}`, parameters: {} },
    ])
  );

  mockMcpManager.tools.mockResolvedValue(largeCatalog);

  const startTime = Date.now();
  const filtered = await service.getPresetTools(config);
  const duration = Date.now() - startTime;

  // Should complete in under 1 second
  expect(duration).toBeLessThan(1000);
  expect(Object.keys(filtered).length).toBeLessThanOrEqual(1000);
});
```

### 5.6 Error Edge Cases

**Test 13: Database Connection Failure**
```typescript
it('should handle database connection failures gracefully', async () => {
  mockDb.select.mockRejectedValue(new Error('ECONNREFUSED'));

  const response = await GET(request);

  expect(response.status).toBe(503); // Service Unavailable
  const error = await response.json();
  expect(error.error).toBe('Database unavailable');
});
```

**Test 14: Partial Server Failure**
```typescript
it('should return tools from healthy servers only', async () => {
  mockMcpManager.getClients.mockResolvedValue({
    'server-1': { status: 'connected', tools: { tool1: {} } },
    'server-2': { status: 'disconnected', tools: {} },
    'server-3': { status: 'connected', tools: { tool3: {} } },
  });

  const tools = await service.getPresetTools(config);

  expect(tools).toHaveProperty('tool1');
  expect(tools).toHaveProperty('tool3');
  expect(tools).not.toHaveProperty('tool2'); // from disconnected server
});
```

**Test 15: Malformed JSON-RPC**
```typescript
it('should reject malformed JSON-RPC requests', async () => {
  const invalidRequests = [
    { jsonrpc: '1.0', id: 1, method: 'tools/list' }, // Wrong version
    { jsonrpc: '2.0', method: 'tools/list' }, // Missing id
    { jsonrpc: '2.0', id: 1 }, // Missing method
    { id: 1, method: 'tools/list' }, // Missing jsonrpc
  ];

  for (const req of invalidRequests) {
    const response = await POST(
      new NextRequest('http://localhost', {
        method: 'POST',
        body: JSON.stringify(req)
      })
    );

    expect(response.status).toBe(400);
    const error = await response.json();
    expect(error.error.code).toBe(-32600); // Invalid Request
  }
});
```

---

## 6. Recommendations

### 6.1 Immediate Actions (Before Implementation)

**Priority 1 - Critical:**
1. Add concurrent access tests (race conditions, parallel updates)
2. Add real database integration tests (use Docker container)
3. Add security tests (SQL injection, XSS prevention)
4. Add timeout and performance tests

**Priority 2 - Important:**
5. Verify cache invalidation actually works (not just called)
6. Add metrics accuracy validation tests
7. Add error recovery tests (DB down, cache down)
8. Add malformed input tests (JSON-RPC, API params)

**Priority 3 - Nice to Have:**
9. Add rate limiting tests
10. Add mutation testing for test quality
11. Add contract tests for mocks
12. Add snapshot tests for complex responses

### 6.2 Test Improvements

**Simplify Over-Mocked Tests:**

**Before (too many mocks):**
```typescript
vi.mock('@/lib/db/pg/repositories/gateway-preset-repository.pg');
vi.mock('@/lib/ai/mcp/gateway/gateway-cache');
vi.mock('@/lib/ai/mcp/gateway/gateway-service');
vi.mock('@/lib/auth/server-auth');
```

**After (integration test with real cache):**
```typescript
vi.mock('@/lib/db/pg/repositories/gateway-preset-repository.pg');
vi.mock('@/lib/auth/server-auth');
// Use real cache and service for integration testing
```

**Better Assertion Strategies:**

**Before (weak assertion):**
```typescript
expect(filtered['filesystem_read_file']).toBeDefined();
```

**After (strong assertion):**
```typescript
expect(filtered).toHaveProperty('filesystem_read_file');
expect(filtered['filesystem_read_file']).toMatchObject({
  description: 'Read file',
  _mcpServerId: 'server-1',
  _originToolName: 'read_file',
});
expect(filtered['filesystem_write_file']).toBeUndefined(); // negative assertion
```

**Improved Mock Patterns:**

**Before (verbose boilerplate):**
```typescript
vi.mock('@/lib/cache');
let mockCache: any;

beforeEach(async () => {
  vi.clearAllMocks();
  const cacheModule = await import('@/lib/cache');
  mockCache = (cacheModule.createCache as any)();
});
```

**After (test utility):**
```typescript
import { setupMocks } from '@/tests/utils/mock-setup';

const { mockCache } = setupMocks(['cache', 'db', 'auth']);
```

### 6.3 Missing E2E Scenarios

**Add these E2E tests:**

**Scenario 1: Complete Tool Execution Flow**
```typescript
test('tool execution end-to-end', async ({ request }) => {
  // 1. Create preset with filesystem server
  const preset = await createPreset({ servers: ['filesystem'] });

  // 2. Call read_file tool via gateway
  const toolResponse = await request.post(`/api/mcp/gateway/${preset.slug}`, {
    data: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'read_file',
        arguments: { path: '/test.txt' }
      },
    },
  });

  // 3. Verify tool result
  expect(toolResponse.status()).toBe(200);
  const result = await toolResponse.json();
  expect(result.result).toHaveProperty('content');

  // 4. Verify metrics were recorded
  const metrics = await request.get(`/api/mcp/metrics/${preset.id}`);
  const metricsData = await metrics.json();
  expect(metricsData.toolCalls).toContainEqual(
    expect.objectContaining({
      toolName: 'read_file',
      status: 'success',
      latencyMs: expect.any(Number),
    })
  );
});
```

**Scenario 2: Multi-User Sharing**
```typescript
test('sharing preset between users', async ({ request, browser }) => {
  // User A creates public preset
  const userA = await authenticateUser('user-a');
  const preset = await userA.createPreset({
    slug: 'shared-tools',
    visibility: 'public'
  });

  // User B accesses preset
  const userB = await authenticateUser('user-b');
  const metadata = await userB.request.get(`/api/mcp/gateway/${preset.slug}`);

  expect(metadata.status()).toBe(200);
  expect(await metadata.json()).toMatchObject({
    slug: 'shared-tools',
    owner: 'user-a',
    visibility: 'public',
  });
});
```

**Scenario 3: Concurrent Operations**
```typescript
test('concurrent preset updates', async ({ request }) => {
  const preset = await createPreset({ name: 'Original' });

  // Two users try to update simultaneously
  const [update1, update2] = await Promise.all([
    request.patch(`/api/mcp/gateway-presets/${preset.id}`, {
      data: { name: 'Update 1' },
    }),
    request.patch(`/api/mcp/gateway-presets/${preset.id}`, {
      data: { name: 'Update 2' },
    }),
  ]);

  // Both should succeed (last write wins or optimistic locking)
  expect([update1.status(), update2.status()]).toContain(200);

  // Final state should be consistent
  const final = await request.get(`/api/mcp/gateway-presets/${preset.id}`);
  const finalData = await final.json();
  expect(['Update 1', 'Update 2']).toContain(finalData.name);
});
```

### 6.4 Test Organization

**Create Test Utilities:**

**File: `tests/utils/mock-setup.ts`**
```typescript
export function setupMocks(modules: string[]) {
  const mocks: Record<string, any> = {};

  if (modules.includes('db')) {
    vi.mock('@/lib/db/pg/db.pg', () => ({
      pgDb: {
        insert: vi.fn(),
        select: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    }));
  }

  if (modules.includes('cache')) {
    vi.mock('@/lib/cache', () => ({
      createCache: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        deletePattern: vi.fn(),
      })),
    }));
  }

  // ... more modules

  return mocks;
}
```

**File: `tests/utils/test-data.ts`**
```typescript
export const createMockPreset = (overrides?: Partial<GatewayPreset>) => ({
  id: generateUUID(),
  userId: 'test-user',
  slug: 'test-preset',
  name: 'Test Preset',
  description: null,
  visibility: 'private' as const,
  status: 'active' as const,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockToolCatalog = (toolCount: number = 5) => {
  return Object.fromEntries(
    Array.from({ length: toolCount }, (_, i) => [
      `tool_${i}`,
      {
        description: `Tool ${i}`,
        parameters: {},
        _mcpServerId: 'server-1',
        _mcpServerName: 'test',
        _originToolName: `tool_${i}`,
        execute: vi.fn(),
      },
    ])
  );
};
```

**File: `tests/utils/integration-db.ts`**
```typescript
import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

let testDb: any;
let client: Client;

export async function setupTestDatabase() {
  client = new Client({
    connectionString: process.env.TEST_DATABASE_URL,
  });

  await client.connect();
  testDb = drizzle(client);

  // Run migrations
  await runMigrations(testDb);

  return testDb;
}

export async function resetTestDatabase() {
  // Truncate all tables
  await testDb.execute('TRUNCATE TABLE gateway_presets CASCADE');
  await testDb.execute('TRUNCATE TABLE gateway_metrics CASCADE');
}

export async function teardownTestDatabase() {
  await client.end();
}
```

---

## 7. Test Coverage Targets

**Current Estimated Coverage:** ~70%

**Target Coverage:**
- **Unit Tests:** 90%+ (repository, service, cache)
- **Integration Tests:** 80%+ (API routes, DB operations)
- **E2E Tests:** 60%+ (critical user flows)
- **Overall:** 85%+

**Coverage Gaps:**
- Error handling: 60% (target: 90%)
- Edge cases: 50% (target: 80%)
- Concurrency: 0% (target: 70%)
- Security: 10% (target: 90%)

---

## 8. Final Verdict

**Recommendation:** PROCEED with implementation, ADD supplementary tests during/after

**Confidence Level:** 7/10

**Why not 10/10:**
- Missing concurrent access tests could cause production bugs
- Insufficient cache verification could lead to stale data issues
- No security testing leaves injection vulnerabilities undetected
- No performance testing could cause timeouts in production

**Action Plan:**
1. **Implement plan as-is** (Phase 1-3)
2. **Add concurrent access tests** (before Phase 2)
3. **Add integration tests with real DB** (before Phase 3)
4. **Add security tests** (before production deployment)
5. **Add performance tests** (during load testing)

**Timeline:**
- Original plan: ~8-10 hours
- With supplementary tests: ~12-15 hours
- Total estimated effort: 2-3 days

---

## Appendix A: Test Template

**Template for Missing Tests:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Feature Name', () => {
  let mockDependency: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Setup mocks
  });

  it('should handle normal case', async () => {
    // Arrange
    const input = { /* test data */ };

    // Act
    const result = await functionUnderTest(input);

    // Assert
    expect(result).toMatchObject({ /* expected output */ });
  });

  it('should handle error case', async () => {
    // Arrange
    mockDependency.mockRejectedValue(new Error('Test error'));

    // Act & Assert
    await expect(functionUnderTest(input)).rejects.toThrow('Test error');
  });

  it('should handle edge case', async () => {
    // Test boundary conditions
  });
});
```

---

## Appendix B: Testing Checklist

**Before Merging PR:**
- [ ] All tests pass (`pnpm test`)
- [ ] Coverage above 85% (`pnpm test:coverage`)
- [ ] No skipped tests (`.skip`, `.todo`)
- [ ] No console.log in tests
- [ ] All mocks are cleared in beforeEach
- [ ] E2E tests clean up data
- [ ] Integration tests use test database
- [ ] Security tests verify input sanitization
- [ ] Performance tests verify acceptable latency
- [ ] Concurrent access tests verify race condition handling

**Before Production Deployment:**
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Failure recovery tested
- [ ] Monitoring/alerting configured
- [ ] Rollback plan documented

---

**End of Review**
