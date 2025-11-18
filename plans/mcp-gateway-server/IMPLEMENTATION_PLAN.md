# MCP Gateway Implementation Plan

## Executive Summary

This document provides a comprehensive, detailed plan for implementing an MCP Gateway that exposes all tools from currently connected MCP servers as a unified MCP server. This will allow external MCP clients (Claude Desktop, Cursor, other MCP-compatible tools) to connect to this application and access all managed tools through a single endpoint.

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Research Findings](#research-findings)
3. [Architecture Overview](#architecture-overview)
4. [Detailed Task Breakdown](#detailed-task-breakdown)
5. [Technical Considerations](#technical-considerations)
6. [Testing Strategy](#testing-strategy)
7. [Documentation Requirements](#documentation-requirements)
8. [Success Criteria](#success-criteria)

---

## Current State Analysis

### Existing Infrastructure

#### MCP Client System
- **MCPClientsManager**: Manages connections to external MCP servers
- **MCPClient**: Individual client for each MCP server connection
- **GatewayService**: Provides tool filtering and circuit breaker for tool execution
- **Storage Layers**: File-based and DB-based MCP configuration storage
- **OAuth Support**: Full OAuth flow for authenticated MCP connections

#### Database Schema
- `mcp_servers` table: Stores MCP server configurations
- `mcp_tool_customizations` table: Tool-specific customizations
- `mcp_server_customizations` table: Server-level customizations
- `mcp_oauth_sessions` table: OAuth session management

#### API Layer
- `/api/mcp/list`: Lists available MCP servers
- `/api/mcp/[id]`: Manage individual MCP servers
- `/api/mcp/export`: Export MCP configurations
- Various customization endpoints

### Current Capabilities
✅ Connect to external MCP servers as CLIENT  
✅ Aggregate tools from multiple servers  
✅ Execute tools with circuit breaker pattern  
✅ Tool filtering via presets  
✅ User-based access control  
✅ OAuth authentication for remote servers  

### Gap Analysis
❌ No MCP SERVER implementation (only client)  
❌ No way for external clients to connect  
❌ No MCP protocol endpoint exposure  
❌ No unified tool catalog endpoint  
❌ No gateway configuration UI  

---

## Research Findings

### MCP Protocol Requirements

From web research and existing codebase analysis:

1. **MCP Server Must Implement**:
   - `tools/list` endpoint: Returns catalog of available tools
   - `tools/call` endpoint: Executes a specific tool
   - Capabilities declaration: Announces server features
   - JSON-RPC 2.0 protocol compliance

2. **Transport Options**:
   - **StdioServerTransport**: For local process communication (already used in custom-mcp-server)
   - **StreamableHTTPServerTransport**: For HTTP-based remote access
   - **SSE (Server-Sent Events)**: For real-time streaming (client support exists)

3. **Tool Schema Format**:
   ```typescript
   {
     name: string,
     description: string,
     inputSchema: {
       type: "object",
       properties: Record<string, any>,
       required: string[],
       additionalProperties: boolean
     }
   }
   ```

4. **Response Format**:
   ```typescript
   {
     content: Array<{
       type: "text" | "image" | "audio" | "resource",
       text?: string,
       data?: string,
       mimeType?: string
     }>,
     isError?: boolean,
     _meta?: Record<string, any>
   }
   ```

### SDK Abstraction Level

The `@modelcontextprotocol/sdk` (v1.20.2) provides:
- **McpServer** class with high-level `server.tool()` API
- **NO manual request handler implementation needed**
- Automatic JSON-RPC protocol handling
- Built-in transport abstractions

### Key Implementation Patterns

From `custom-mcp-server/index.ts`:
```typescript
const server = new McpServer({ name, version });
server.tool(toolName, description, zodSchema, async (args) => {
  return { content: [{ type: "text", text: result }] };
});
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## Architecture Overview

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                    External MCP Clients                      │
│          (Claude Desktop, Cursor, Other Tools)               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ MCP Protocol (HTTP/SSE)
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    MCP Gateway Server                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  HTTP/SSE Endpoint (/api/mcp/gateway)                │   │
│  │  - Authentication & Authorization                     │   │
│  │  - tools/list handler                                 │   │
│  │  - tools/call handler                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                  │
│  ┌──────────────────────────▼──────────────────────────┐   │
│  │  MCPGatewayServer (New)                             │   │
│  │  - Tool catalog aggregation                          │   │
│  │  - Tool filtering (by user/preset)                   │   │
│  │  - Request routing                                   │   │
│  │  - Response transformation                           │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                  │
│  ┌──────────────────────────▼──────────────────────────┐   │
│  │  MCPClientsManager (Existing)                       │   │
│  │  - Manages connections to backend MCP servers        │   │
│  │  - Tool execution via toolCall()                     │   │
│  │  - Circuit breaker integration                       │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                ┌───────────┼───────────┐
                │           │           │
        ┌───────▼────┐ ┌───▼─────┐ ┌──▼──────┐
        │ MCP Server │ │ MCP     │ │ MCP     │
        │ A          │ │ Server  │ │ Server  │
        │            │ │ B       │ │ C       │
        └────────────┘ └─────────┘ └─────────┘
```

### Component Relationships

1. **MCPGatewayServer** (New):
   - Creates MCP Server instance using SDK
   - Registers tools dynamically from MCPClientsManager
   - Handles MCP protocol requests
   - Applies filtering based on configuration

2. **MCPGatewayManager** (New):
   - Singleton managing gateway lifecycle
   - Configuration management
   - Start/stop gateway server
   - Status reporting

3. **Gateway Configuration** (New):
   - Database model for gateway settings
   - Per-user or per-preset configurations
   - Tool/server filtering rules
   - Authentication settings

4. **API Endpoints** (New):
   - `/api/mcp/gateway/config` - Gateway configuration CRUD
   - `/api/mcp/gateway/status` - Gateway status/health
   - `/api/mcp/gateway` - MCP protocol endpoint (POST)

5. **UI Components** (New):
   - Gateway configuration panel
   - Tool selection interface
   - Connection information display
   - Status monitoring

---

## Detailed Task Breakdown

### Task 1: Foundation - Type Definitions & Core Interfaces (~5 steps)

**Goal**: Establish type-safe foundation for gateway implementation

#### Step 1.1: Create Gateway Type Definitions
**File**: `src/types/mcp-gateway.ts`

Create:
- `MCPGatewayConfig` - Gateway configuration schema
- `MCPGatewayConfigDb` - Database model
- `MCPProtocolTool` - MCP protocol tool format
- `MCPToolCallRequest` - Tool call request format
- `MCPToolCallResponse` - Tool call response format
- `MCPToolsListRequest` - Tool list request format
- `MCPToolsListResponse` - Tool list response format
- `MCPGatewayStatus` - Gateway status information

Include Zod schemas for validation.

#### Step 1.2: Create Database Migration
**File**: `src/lib/db/migrations/XXXX_add_mcp_gateway_config.sql`

Create table:
```sql
CREATE TABLE mcp_gateway_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
  description TEXT,
  exposed_server_ids TEXT[] DEFAULT '{}',
  exposed_tool_ids TEXT[] DEFAULT '{}',
  require_auth BOOLEAN NOT NULL DEFAULT true,
  api_key VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_mcp_gateway_configs_user_id ON mcp_gateway_configs(user_id);
CREATE INDEX idx_mcp_gateway_configs_enabled ON mcp_gateway_configs(enabled);
```

#### Step 1.3: Create Database Schema Types
**File**: `src/lib/db/pg/schema.pg.ts`

Add Drizzle ORM schema:
```typescript
export const mcpGatewayConfigsTable = pgTable("mcp_gateway_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, {
    onDelete: "cascade",
  }),
  enabled: boolean("enabled").notNull().default(false),
  name: varchar("name", { length: 255 }).notNull(),
  version: varchar("version", { length: 50 }).notNull().default("1.0.0"),
  description: text("description"),
  exposedServerIds: text("exposed_server_ids").array().default(sql`'{}'`),
  exposedToolIds: text("exposed_tool_ids").array().default(sql`'{}'`),
  requireAuth: boolean("require_auth").notNull().default(true),
  apiKey: varchar("api_key", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

#### Step 1.4: Create Repository Interface
**File**: `src/lib/db/repository/mcp-gateway-repository.ts`

Implement:
```typescript
export interface MCPGatewayConfigRepository {
  getByUserId(userId: string): Promise<MCPGatewayConfigDb | null>;
  upsert(config: Partial<MCPGatewayConfigDb>): Promise<MCPGatewayConfigDb>;
  delete(userId: string): Promise<void>;
  updateEnabled(userId: string, enabled: boolean): Promise<void>;
}
```

#### Step 1.5: Create Unit Tests for Types
**File**: `src/types/mcp-gateway.test.ts`

Test:
- Zod schema validation
- Type inference correctness
- Default value handling
- Invalid input rejection

**Validation Criteria**:
- All types compile without errors
- Zod schemas validate correct data
- Zod schemas reject invalid data
- Repository interface matches database schema

---

### Task 2: Core Gateway Server Implementation (~5 steps)

**Goal**: Implement MCP server using @modelcontextprotocol/sdk

#### Step 2.1: Create Utility Functions
**File**: `src/lib/ai/mcp/gateway/gateway-utils.ts`

Implement:
```typescript
// Convert VercelAIMcpTool to MCP protocol format
export function convertToMCPProtocolTool(
  toolId: string,
  tool: VercelAIMcpTool
): MCPProtocolTool;

// Extract Zod schema properties for MCP inputSchema
export function extractZodSchemaProperties(zodSchema: any): {
  properties: Record<string, any>;
  required: string[];
};

// Transform tool execution result to MCP format
export function transformToolResult(result: any): MCPToolCallResponse["content"];

// Generate gateway connection URL
export function generateGatewayUrl(userId: string): string;

// Validate API key
export function validateGatewayApiKey(apiKey: string, userId: string): Promise<boolean>;
```

#### Step 2.2: Create MCPGatewayServer Class
**File**: `src/lib/ai/mcp/gateway/mcp-gateway-server.ts`

Implement class with:
```typescript
export class MCPGatewayServer {
  private server: Server; // from @modelcontextprotocol/sdk
  private config: MCPGatewayConfig;
  private mcpManager: MCPClientsManager;
  
  constructor(config: MCPGatewayConfig, mcpManager: MCPClientsManager);
  
  // Initialize and register tools
  private async setupHandlers(): Promise<void>;
  
  // Handle tools/list request
  private async handleToolsList(request: MCPToolsListRequest): Promise<MCPToolsListResponse>;
  
  // Handle tools/call request
  private async handleToolCall(request: MCPToolCallRequest): Promise<MCPToolCallResponse>;
  
  // Filter tools based on configuration
  private filterTools(allTools: Record<string, VercelAIMcpTool>): Record<string, VercelAIMcpTool>;
  
  // Get the underlying Server instance
  public getServer(): Server;
  
  // Get gateway status
  public async getStatus(): Promise<MCPGatewayStatus>;
}
```

**Key Implementation Details**:
- Use `Server` from `@modelcontextprotocol/sdk/server/index.js`
- Declare capabilities: `{ tools: { listChanged: true } }`
- Use `server.setRequestHandler()` for tools/list and tools/call
- Implement pagination support for tools/list (using cursor)
- Apply circuit breaker pattern from GatewayService
- Handle errors gracefully, returning MCP error format

#### Step 2.3: Create Gateway Manager Singleton
**File**: `src/lib/ai/mcp/gateway/mcp-gateway-manager.ts`

Implement singleton:
```typescript
class MCPGatewayManager {
  private gatewayServer?: MCPGatewayServer;
  private config?: MCPGatewayConfig;
  
  // Initialize or update gateway
  async initialize(config: MCPGatewayConfig): Promise<void>;
  
  // Get current gateway instance
  getGatewayServer(): MCPGatewayServer | undefined;
  
  // Check if enabled
  isEnabled(): boolean;
  
  // Get current config
  getConfig(): MCPGatewayConfig | undefined;
  
  // Update configuration
  async updateConfig(config: Partial<MCPGatewayConfig>): Promise<void>;
  
  // Get status
  async getStatus(): Promise<MCPGatewayStatus>;
}

export const mcpGatewayManager = new MCPGatewayManager();
```

#### Step 2.4: Create Unit Tests for Gateway Server
**File**: `src/lib/ai/mcp/gateway/mcp-gateway-server.test.ts`

Test scenarios:
- Tool conversion to MCP format
- Tool filtering by server ID
- Tool filtering by tool ID
- Tools list with pagination
- Tool call routing to correct backend
- Error handling and transformation
- Circuit breaker integration
- Status reporting

Mock MCPClientsManager for isolated testing.

#### Step 2.5: Create Integration Tests
**File**: `src/lib/ai/mcp/gateway/mcp-gateway-integration.test.ts`

Test with actual MCP client:
- Connect to gateway server
- List available tools
- Execute a tool
- Handle tool errors
- Verify response format

Use test MCP server from `tests/fixtures/test-mcp-server.js`.

**Validation Criteria**:
- MCPGatewayServer successfully initializes
- Tools are correctly converted to MCP format
- Tool filtering works as expected
- Tool calls route to correct backend servers
- Errors are properly formatted
- All unit tests pass
- Integration tests pass

---

### Task 3: HTTP Transport Layer & API Endpoints (~5 steps)

**Goal**: Expose gateway via HTTP endpoint with proper authentication

#### Step 3.1: Research Transport Options
**Investigation Task**:
- Check if `@modelcontextprotocol/sdk` provides SSE server transport
- Review `StreamableHTTPServerTransport` usage patterns
- Examine existing custom-mcp-server implementation
- Determine best transport for remote access
- Document findings in `plans/mcp-gateway-server/transport-research.md`

Expected outputs:
- Recommended transport type (SSE vs StreamableHTTP)
- Import path and usage example
- Limitations and considerations
- Example code snippet

#### Step 3.2: Create Gateway API Route
**File**: `src/app/api/mcp/gateway/route.ts`

Implement POST endpoint:
```typescript
export async function POST(request: Request) {
  // 1. Authenticate request
  const session = await getSession();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  // 2. Check if gateway is enabled for user
  const config = await getGatewayConfig(session.user.id);
  if (!config?.enabled) {
    return new Response("Gateway not enabled", { status: 403 });
  }
  
  // 3. Validate API key if required
  if (config.requireAuth) {
    const apiKey = request.headers.get("X-API-Key");
    if (!validateApiKey(apiKey, config)) {
      return new Response("Invalid API key", { status: 401 });
    }
  }
  
  // 4. Get gateway server instance
  const gatewayServer = mcpGatewayManager.getGatewayServer();
  if (!gatewayServer) {
    return new Response("Gateway not initialized", { status: 500 });
  }
  
  // 5. Create transport and handle request
  const transport = new StreamableHTTPServerTransport();
  await gatewayServer.getServer().connect(transport);
  
  const body = await request.json();
  return transport.handleRequest(request, body);
}
```

#### Step 3.3: Create Configuration API Routes
**File**: `src/app/api/mcp/gateway/config/route.ts`

Implement CRUD operations:
```typescript
// GET - Fetch user's gateway configuration
export async function GET(request: Request);

// POST - Create or update gateway configuration
export async function POST(request: Request);

// DELETE - Delete gateway configuration
export async function DELETE(request: Request);
```

**File**: `src/app/api/mcp/gateway/config/actions.ts`

Server actions:
```typescript
export async function getGatewayConfig(userId: string): Promise<MCPGatewayConfigDb | null>;
export async function upsertGatewayConfig(config: Partial<MCPGatewayConfigDb>): Promise<MCPGatewayConfigDb>;
export async function deleteGatewayConfig(userId: string): Promise<void>;
export async function toggleGatewayEnabled(userId: string, enabled: boolean): Promise<void>;
export async function regenerateApiKey(userId: string): Promise<string>;
```

#### Step 3.4: Create Status API Route
**File**: `src/app/api/mcp/gateway/status/route.ts`

Implement GET endpoint:
```typescript
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  const status = await mcpGatewayManager.getStatus();
  const config = await getGatewayConfig(session.user.id);
  
  return Response.json({
    ...status,
    url: config?.enabled ? generateGatewayUrl(session.user.id) : null,
    apiKey: config?.apiKey,
  });
}
```

#### Step 3.5: Add CORS and Security Headers
**File**: `src/app/api/mcp/gateway/middleware.ts`

Implement middleware:
```typescript
export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
  };
}

export function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
  };
}
```

Add OPTIONS handler for CORS preflight.

**Validation Criteria**:
- Gateway endpoint responds to MCP protocol requests
- Authentication works correctly
- API key validation functions
- Configuration endpoints work
- Status endpoint returns accurate information
- CORS is properly configured
- Security headers are present

---

### Task 4: User Interface & Configuration (~5 steps)

**Goal**: Create UI for gateway configuration and management

#### Step 4.1: Create Gateway Configuration Component
**File**: `src/components/mcp-gateway-config.tsx`

Implement component:
```typescript
export function MCPGatewayConfig() {
  return (
    <div className="space-y-6">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <Label>Enable MCP Gateway</Label>
        <Switch checked={enabled} onCheckedChange={handleToggle} />
      </div>
      
      {/* Gateway Information */}
      {enabled && (
        <>
          <div className="space-y-2">
            <Label>Gateway URL</Label>
            <Input value={gatewayUrl} readOnly />
            <Button onClick={copyToClipboard}>Copy URL</Button>
          </div>
          
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input type="password" value={apiKey} readOnly />
            <Button onClick={regenerateApiKey}>Regenerate</Button>
          </div>
          
          <Alert>
            <AlertTitle>Connection Instructions</AlertTitle>
            <AlertDescription>
              Add this configuration to your MCP client (Claude Desktop, Cursor, etc.)
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}
```

#### Step 4.2: Create Tool Selection Component
**File**: `src/components/mcp-gateway-tool-selector.tsx`

Implement component:
```typescript
export function MCPGatewayToolSelector({
  exposedServerIds,
  exposedToolIds,
  onServerIdsChange,
  onToolIdsChange,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Server Selection */}
      <div>
        <Label>Exposed MCP Servers</Label>
        <MultiSelect
          options={availableServers}
          selected={exposedServerIds}
          onChange={onServerIdsChange}
          placeholder="Select servers (empty = all servers)"
        />
      </div>
      
      {/* Tool Selection */}
      <div>
        <Label>Exposed Tools</Label>
        <MultiSelect
          options={availableTools}
          selected={exposedToolIds}
          onChange={onToolIdsChange}
          placeholder="Select tools (empty = all tools)"
        />
      </div>
      
      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{filteredToolCount} tools will be exposed</p>
          <p>{filteredServerCount} servers will be accessible</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### Step 4.3: Create Status Display Component
**File**: `src/components/mcp-gateway-status.tsx`

Implement component:
```typescript
export function MCPGatewayStatus() {
  const { status, isLoading } = useGatewayStatus();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gateway Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <StatusIndicator status={status.enabled ? "online" : "offline"} />
          <span>{status.enabled ? "Enabled" : "Disabled"}</span>
        </div>
        
        {status.enabled && (
          <>
            <div>
              <Label>Server Name</Label>
              <p>{status.serverName}</p>
            </div>
            
            <div>
              <Label>Version</Label>
              <p>{status.version}</p>
            </div>
            
            <div>
              <Label>Total Tools</Label>
              <p>{status.totalTools}</p>
            </div>
            
            <div>
              <Label>Exposed Servers</Label>
              <p>{status.exposedServerCount}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

#### Step 4.4: Integrate into Settings Page
**File**: `src/app/(chat)/settings/mcp-gateway/page.tsx`

Create dedicated settings page:
```typescript
export default function MCPGatewaySettingsPage() {
  return (
    <div className="container max-w-4xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">MCP Gateway</h1>
        <p className="text-muted-foreground">
          Expose your connected MCP tools as a unified server for external clients
        </p>
      </div>
      
      <MCPGatewayStatus />
      
      <MCPGatewayConfig />
      
      <MCPGatewayToolSelector />
      
      <ConnectionInstructions />
    </div>
  );
}
```

#### Step 4.5: Create React Hooks for Gateway
**File**: `src/hooks/use-mcp-gateway.ts`

Implement hooks:
```typescript
export function useGatewayConfig() {
  // Fetch and manage gateway configuration
}

export function useGatewayStatus() {
  // Poll gateway status
  // Return real-time status information
}

export function useGatewayToggle() {
  // Toggle gateway enabled/disabled
  // Handle loading and error states
}

export function useApiKeyRegeneration() {
  // Regenerate API key
  // Update configuration
}
```

**Validation Criteria**:
- UI renders correctly
- Configuration can be updated
- API key can be regenerated
- Tool/server selection works
- Status updates in real-time
- Connection information is displayed
- Copy-to-clipboard functionality works

---

### Task 5: Documentation & Connection Instructions (~5 steps)

**Goal**: Provide comprehensive documentation for users and developers

#### Step 5.1: Create User Guide
**File**: `docs/mcp-gateway.md`

Write comprehensive guide covering:
- What is the MCP Gateway?
- Use cases and benefits
- Enabling the gateway
- Configuring tool exposure
- Security considerations
- Connecting external clients
- Troubleshooting common issues

#### Step 5.2: Create Client Connection Instructions
**File**: `docs/mcp-gateway-client-setup.md`

Provide instructions for:

**Claude Desktop**:
```json
{
  "mcpServers": {
    "better-chatbot-gateway": {
      "url": "https://your-domain.com/api/mcp/gateway",
      "headers": {
        "X-API-Key": "your-api-key-here"
      }
    }
  }
}
```

**Cursor IDE**:
```json
{
  "mcp": {
    "servers": {
      "better-chatbot-gateway": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/client", "connect", "https://your-domain.com/api/mcp/gateway"],
        "env": {
          "API_KEY": "your-api-key-here"
        }
      }
    }
  }
}
```

**MCP Inspector** (for testing):
```bash
npx @modelcontextprotocol/inspector https://your-domain.com/api/mcp/gateway
```

#### Step 5.3: Create API Documentation
**File**: `docs/api/mcp-gateway.md`

Document all API endpoints:
- `POST /api/mcp/gateway` - MCP protocol endpoint
- `GET /api/mcp/gateway/config` - Get configuration
- `POST /api/mcp/gateway/config` - Update configuration
- `DELETE /api/mcp/gateway/config` - Delete configuration
- `GET /api/mcp/gateway/status` - Get status

Include:
- Request/response formats
- Authentication requirements
- Error codes and messages
- Example curl commands

#### Step 5.4: Create In-App Instructions Component
**File**: `src/components/mcp-gateway-connection-instructions.tsx`

Implement interactive component:
```typescript
export function ConnectionInstructions({ gatewayUrl, apiKey }: Props) {
  const [selectedClient, setSelectedClient] = useState<"claude" | "cursor">("claude");
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection Instructions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={selectedClient} onValueChange={setSelectedClient}>
          <TabsList>
            <TabsTrigger value="claude">Claude Desktop</TabsTrigger>
            <TabsTrigger value="cursor">Cursor IDE</TabsTrigger>
          </TabsList>
          
          <TabsContent value="claude">
            <CodeBlock language="json">
              {generateClaudeConfig(gatewayUrl, apiKey)}
            </CodeBlock>
            <Button onClick={copyConfig}>Copy Configuration</Button>
          </TabsContent>
          
          <TabsContent value="cursor">
            <CodeBlock language="json">
              {generateCursorConfig(gatewayUrl, apiKey)}
            </CodeBlock>
            <Button onClick={copyConfig}>Copy Configuration</Button>
          </TabsContent>
        </Tabs>
        
        <Alert>
          <AlertTitle>Next Steps</AlertTitle>
          <AlertDescription>
            <ol className="list-decimal list-inside space-y-1">
              <li>Copy the configuration above</li>
              <li>Open your MCP client's configuration file</li>
              <li>Add the copied configuration</li>
              <li>Restart your MCP client</li>
              <li>Verify connection by listing available tools</li>
            </ol>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
```

#### Step 5.5: Add README Updates
**File**: `README.md`

Add section about MCP Gateway:
- Brief overview
- Key features
- Link to detailed documentation
- Quick start example

**Validation Criteria**:
- Documentation is clear and comprehensive
- Code examples are correct and tested
- Connection instructions work for all clients
- In-app instructions are helpful
- README is updated

---

### Task 6: Testing & Validation (~5 steps)

**Goal**: Ensure gateway works correctly with real MCP clients

#### Step 6.1: Create End-to-End Test Suite
**File**: `tests/mcp-gateway/e2e.spec.ts`

Test scenarios:
```typescript
describe("MCP Gateway E2E", () => {
  test("should enable gateway via UI", async ({ page }) => {
    // Navigate to settings
    // Toggle gateway enabled
    // Verify API key is generated
    // Verify gateway URL is displayed
  });
  
  test("should configure exposed tools", async ({ page }) => {
    // Select specific servers
    // Select specific tools
    // Save configuration
    // Verify preview shows correct count
  });
  
  test("should connect external MCP client", async () => {
    // Create MCP client instance
    // Connect to gateway endpoint
    // Verify connection successful
  });
  
  test("should list tools via MCP client", async () => {
    // Connect client
    // Call tools/list
    // Verify correct tools returned
    // Verify tool schema format
  });
  
  test("should execute tool via MCP client", async () => {
    // Connect client
    // List tools
    // Call a specific tool
    // Verify result format
    // Verify result correctness
  });
  
  test("should handle authentication", async () => {
    // Test without API key - should fail
    // Test with invalid API key - should fail
    // Test with valid API key - should succeed
  });
  
  test("should handle tool filtering", async () => {
    // Configure to expose only certain tools
    // Connect client
    // List tools
    // Verify only configured tools are returned
  });
});
```

#### Step 6.2: Test with MCP Inspector
**Manual Test Plan**:

1. Enable gateway in settings
2. Copy gateway URL and API key
3. Run: `npx @modelcontextprotocol/inspector <gateway-url>`
4. Provide API key when prompted
5. Verify tools are listed correctly
6. Execute a simple tool (e.g., web search)
7. Verify response format
8. Test error handling (call non-existent tool)

Document results in `tests/mcp-gateway/inspector-test-results.md`

#### Step 6.3: Test with Claude Desktop (if available)
**Manual Test Plan**:

1. Add gateway configuration to Claude Desktop config
2. Restart Claude Desktop
3. Verify gateway appears in available servers
4. List tools in Claude
5. Execute a tool via Claude chat
6. Verify tool executes correctly
7. Test with multiple tool calls in sequence
8. Test with complex tool arguments

Document results in `tests/mcp-gateway/claude-desktop-test-results.md`

#### Step 6.4: Performance Testing
**File**: `tests/mcp-gateway/performance.test.ts`

Test:
```typescript
describe("Gateway Performance", () => {
  test("should handle concurrent tool list requests", async () => {
    // Simulate 10 concurrent clients
    // Each calls tools/list
    // Measure response time
    // Verify all succeed
  });
  
  test("should handle concurrent tool executions", async () => {
    // Simulate 5 concurrent tool calls
    // Measure execution time
    // Verify circuit breaker works
  });
  
  test("should handle large tool catalog", async () => {
    // Connect 10+ MCP servers
    // Measure tools/list response time
    // Verify pagination works
  });
  
  test("should handle tool execution timeout", async () => {
    // Call a slow tool
    // Verify timeout handling
    // Verify error response format
  });
});
```

Benchmark targets:
- tools/list < 500ms for 100 tools
- tools/call < 5s for normal tools
- Circuit breaker opens after 50% failure rate
- No memory leaks after 1000 requests

#### Step 6.5: Security Testing
**File**: `tests/mcp-gateway/security.test.ts`

Test:
```typescript
describe("Gateway Security", () => {
  test("should reject unauthenticated requests", async () => {
    // Call gateway without session
    // Verify 401 response
  });
  
  test("should reject invalid API keys", async () => {
    // Call with wrong API key
    // Verify 401 response
  });
  
  test("should enforce tool filtering", async () => {
    // Configure to expose limited tools
    // Try to call non-exposed tool
    // Verify rejection
  });
  
  test("should prevent access to other users' gateways", async () => {
    // User A creates gateway
    // User B tries to use User A's API key
    // Verify rejection
  });
  
  test("should handle SQL injection attempts", async () => {
    // Try injecting SQL in tool names
    // Try injecting SQL in arguments
    // Verify proper escaping
  });
});
```

**Validation Criteria**:
- All automated tests pass
- Manual testing with MCP Inspector succeeds
- Claude Desktop integration works (if tested)
- Performance meets benchmarks
- Security tests pass
- No regressions in existing functionality

---

## Technical Considerations

### 1. Transport Selection

**Decision Point**: Which transport to use for gateway endpoint?

**Options**:
- **StdioServerTransport**: ✅ Works for local-only access, ❌ Not suitable for remote clients
- **StreamableHTTPServerTransport**: ✅ HTTP-based, ✅ Works for remote access, ❓ Need to verify SDK support
- **SSE Server Transport**: ✅ Real-time streaming, ❓ Check if SDK provides server implementation

**Recommendation**: Research Task 3.1 will determine the best option. Likely StreamableHTTP or SSE.

### 2. Dynamic vs Static Tool Registration

**Challenge**: MCP SDK pattern registers tools before `server.connect()`. But our tools are dynamic (from database).

**Solutions**:
1. **Pre-register all tools**: Register all possible tools at startup, filter in handlers
2. **Recreate server on config change**: Destroy and recreate server when configuration changes
3. **Proxy pattern**: Use a single catch-all tool that proxies to real tools

**Recommendation**: Option 2 (recreate on config change) - cleanest approach, acceptable restart cost.

### 3. Authentication Strategy

**Challenge**: How to authenticate external MCP clients?

**Options**:
1. **API Key in headers**: Simple, works with most clients
2. **OAuth flow**: More secure, complex setup
3. **JWT tokens**: Standard, requires token refresh logic

**Recommendation**: API Key for MVP (simplest), add OAuth later if needed.

**Implementation**:
- Generate random API key on gateway enable
- Store hashed version in database
- Validate on each request via `X-API-Key` header
- Allow regeneration via UI

### 4. Tool Filtering Strategy

**Challenge**: How to apply tool filtering efficiently?

**Approach**:
```typescript
// At gateway startup, register filtered tools
async setupHandlers() {
  const allTools = await this.mcpManager.tools();
  const filtered = this.filterTools(allTools);
  
  // Register each filtered tool
  for (const [toolId, tool] of Object.entries(filtered)) {
    this.server.tool(
      toolId,
      tool.description,
      extractZodSchema(tool.parameters),
      async (args) => {
        return this.executeToolCall(toolId, args);
      }
    );
  }
}
```

### 5. Error Handling & Circuit Breaker

**Integration with existing GatewayService**:
- Reuse circuit breaker from `GatewayService`
- Transform errors to MCP format
- Log all errors for debugging
- Include gateway metadata in `_meta` field

### 6. Pagination for Large Tool Catalogs

**Implementation**:
```typescript
// Store tools in memory, paginate on request
private tools: MCPProtocolTool[] = [];
private pageSize = 50;

async handleToolsList(request: MCPToolsListRequest) {
  const cursor = request.cursor ? parseInt(request.cursor) : 0;
  const page = this.tools.slice(cursor, cursor + this.pageSize);
  
  return {
    tools: page,
    nextCursor: cursor + this.pageSize < this.tools.length
      ? (cursor + this.pageSize).toString()
      : undefined,
  };
}
```

### 7. Multi-Instance Deployment

**Challenge**: Gateway state in memory, but app may run on multiple instances.

**Solutions**:
1. **Sticky sessions**: Route same user to same instance
2. **Stateless design**: Gateway recreates state on each request
3. **Shared state in Redis**: Store gateway config in Redis

**Recommendation**: Start with stateless (option 2), add Redis if needed for performance.

### 8. Monitoring & Observability

**Metrics to track**:
- Number of active gateways
- Total tool calls through gateway
- Tool call latency
- Error rate
- Circuit breaker state

**Implementation**:
- Add logging to all gateway operations
- Use existing logger with tags
- Consider adding metrics endpoint

### 9. Rate Limiting

**Consideration**: Should gateway enforce rate limits?

**Recommendation**: Yes, add basic rate limiting:
- Per user: 100 requests/minute
- Per IP: 200 requests/minute
- Use sliding window algorithm
- Return 429 when exceeded

### 10. Versioning

**Strategy**:
- Gateway version in config (e.g., "1.0.0")
- MCP protocol version support
- Handle breaking changes gracefully

---

## Testing Strategy

### Unit Testing
- All utility functions
- Tool conversion logic
- Filtering logic
- Error transformation
- Repository operations

### Integration Testing
- Gateway server initialization
- Tool registration
- Request handling
- Database operations
- Authentication flow

### End-to-End Testing
- Full user workflow (UI → API → Gateway → Backend)
- External client connection
- Tool execution through gateway
- Error scenarios
- Multi-user scenarios

### Manual Testing
- MCP Inspector integration
- Claude Desktop integration (if available)
- Cursor IDE integration (if available)
- UI/UX validation

### Performance Testing
- Concurrent requests
- Large tool catalogs
- Long-running tools
- Memory leaks
- Circuit breaker behavior

### Security Testing
- Authentication bypass attempts
- Authorization checks
- Input validation
- SQL injection
- XSS attempts

---

## Documentation Requirements

### User Documentation
- What is MCP Gateway? (concept)
- Why use MCP Gateway? (benefits)
- How to enable gateway? (step-by-step)
- How to configure tools? (guide)
- How to connect clients? (instructions)
- Troubleshooting (common issues)

### Developer Documentation
- Architecture overview
- API reference
- Type definitions
- Code examples
- Extension points
- Testing guide

### Connection Guides
- Claude Desktop setup
- Cursor IDE setup
- MCP Inspector usage
- Custom client integration

### In-App Documentation
- Tooltips and hints
- Connection instructions
- Status indicators
- Error messages

---

## Success Criteria

### Functional Requirements
✅ Gateway can be enabled/disabled per user  
✅ Tools from connected MCP servers are aggregated  
✅ Tools can be filtered by server/tool ID  
✅ External MCP clients can connect to gateway  
✅ Tools can be listed via MCP protocol  
✅ Tools can be executed via MCP protocol  
✅ API key authentication works  
✅ Configuration is persisted in database  
✅ UI for gateway management exists  

### Non-Functional Requirements
✅ Gateway responds within 500ms for tools/list  
✅ Tool execution timeout is enforced  
✅ Circuit breaker prevents cascading failures  
✅ Authentication prevents unauthorized access  
✅ Tool filtering is secure  
✅ Documentation is comprehensive  
✅ Tests achieve >80% coverage  

### User Experience
✅ Gateway is easy to enable/configure  
✅ Connection instructions are clear  
✅ Status is visible and accurate  
✅ Errors are understandable  
✅ API key management is simple  

### Developer Experience
✅ Code is well-documented  
✅ Architecture is clear  
✅ Extension is straightforward  
✅ Testing is comprehensive  
✅ Debugging is easy  

---

## Implementation Sequence

Based on dependencies, implement in this order:

1. **Task 1** (Foundation) - Required for everything else
2. **Task 2** (Core Server) - Required for API and UI
3. **Task 3** (API Layer) - Required for UI and external access
4. **Task 4** (UI) - Can be done in parallel with Task 5
5. **Task 5** (Documentation) - Can be done in parallel with Task 4
6. **Task 6** (Testing) - Final validation of everything

**Estimated Timeline**:
- Task 1: 1-2 days
- Task 2: 2-3 days
- Task 3: 1-2 days
- Task 4: 2-3 days
- Task 5: 1-2 days
- Task 6: 2-3 days

**Total**: 9-15 days (assuming one developer working full-time)

---

## Risk Mitigation

### Risk: SDK doesn't support needed transport
**Mitigation**: Task 3.1 research determines this early. Fallback: implement custom transport wrapper.

### Risk: Performance issues with many tools
**Mitigation**: Implement pagination (built into plan). Monitor performance metrics.

### Risk: External clients don't connect
**Mitigation**: Test with MCP Inspector early (Task 6.2). Iterate on transport implementation.

### Risk: Security vulnerabilities
**Mitigation**: Comprehensive security testing (Task 6.5). Code review. Penetration testing.

### Risk: User confusion
**Mitigation**: Clear documentation (Task 5). In-app instructions. Helpful error messages.

### Risk: Database migration issues
**Mitigation**: Test migration on copy of production data. Provide rollback script. Document process.

---

## Future Enhancements

Beyond MVP:

1. **Advanced Authentication**:
   - OAuth 2.0 support
   - JWT token-based auth
   - Per-tool API keys

2. **Enhanced Monitoring**:
   - Grafana dashboards
   - Alert rules
   - Usage analytics

3. **Tool Caching**:
   - Cache tool results
   - Configurable TTL
   - Invalidation strategies

4. **Rate Limiting**:
   - Per-user quotas
   - Per-tool quotas
   - Dynamic rate adjustment

5. **Gateway Templates**:
   - Pre-configured templates
   - Import/export configurations
   - Shareable templates

6. **Webhook Support**:
   - Notify on tool execution
   - Notify on errors
   - Custom webhooks

7. **Tool Transformation**:
   - Transform tool arguments
   - Transform tool responses
   - Custom middleware

8. **Multi-Gateway Support**:
   - Multiple gateways per user
   - Different tool sets per gateway
   - Gateway clustering

---

## Conclusion

This plan provides a comprehensive roadmap for implementing an MCP Gateway that exposes all tools from connected MCP servers as a unified MCP server. The implementation is broken down into 6 bite-sized tasks, each with ~5 steps, making it manageable and trackable.

The plan considers:
- ✅ Technical feasibility (leverages existing infrastructure)
- ✅ User experience (clear UI and documentation)
- ✅ Security (authentication and authorization)
- ✅ Performance (circuit breaker, pagination)
- ✅ Maintainability (clean architecture, tests)
- ✅ Extensibility (room for future enhancements)

Implementation should follow the task order outlined, with continuous testing and validation at each step.
