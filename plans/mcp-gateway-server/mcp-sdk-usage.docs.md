# MCP SDK Usage Research

## Summary
The codebase uses `@modelcontextprotocol/sdk` v1.20.2 for both MCP client and server implementations. Existing code shows clear patterns for creating MCP servers using the simplified `McpServer` class with `server.tool()` for tool registration and `StdioServerTransport` for stdio communication. The SDK provides higher-level abstractions that handle request schemas and protocol details automatically.

## Key Components

### Server Implementation Files
- `custom-mcp-server/index.ts`: Production MCP server example using weather API
- `tests/fixtures/test-mcp-server.js`: Test fixture MCP server with simplified tool
- `src/lib/ai/mcp/create-mcp-client.ts`: Client-side MCP implementation patterns
- `src/lib/ai/mcp/create-mcp-clients-manager.ts`: Manager for multiple MCP client connections
- `src/app/api/mcp/actions.ts`: Server actions that proxy tool calls via mcpClientsManager
- `src/types/mcp.ts`: TypeScript type definitions for MCP protocol

### Client Integration Files
- `src/lib/ai/mcp/pg-oauth-provider.ts`: OAuth provider for authenticated MCP connections
- `src/lib/ai/mcp/mcp-manager.ts`: Global singleton manager instance

## Implementation Patterns

### 1. MCP Server Creation Pattern

**File**: `custom-mcp-server/index.ts` (Lines 1-40)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Create server instance with name and version
const server = new McpServer({
  name: "custom-mcp-server",
  version: "0.0.1",
});

// Register tools using server.tool() method
server.tool(
  "get_weather",                          // Tool name
  "Get the current weather at a location.", // Description
  {
    latitude: z.number(),                 // Zod schema for input validation
    longitude: z.number(),
  },
  async ({ latitude, longitude }) => {    // Handler function
    // Perform tool logic
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?...`);
    const data = await response.json();

    // Return MCP-formatted response
    return {
      content: [
        {
          type: "text",
          text: `The current temperature in ${latitude}, ${longitude} is ${data.current.temperature_2m}°C.`,
        },
      ],
    };
  },
);

// Create transport and connect
const transport = new StdioServerTransport();
await server.connect(transport);
```

**Key Observations**:
- `McpServer` class handles all protocol details automatically
- Tool registration uses high-level `server.tool()` API (NOT manual request handlers)
- Zod schemas for input validation
- Returns structured content array with `type` and `text` fields
- Stdio transport is fire-and-forget after connect

### 2. Transport Mechanisms

#### Stdio Transport (Server-side)
**File**: `custom-mcp-server/index.ts` (Lines 37-40)

```typescript
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Usage**: For local process communication via stdin/stdout

#### HTTP/SSE Transports (Client-side)
**File**: `src/lib/ai/mcp/create-mcp-client.ts` (Lines 231-295)

```typescript
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Primary: Streamable HTTP transport
this.transport = new StreamableHTTPClientTransport(url, {
  requestInit: {
    headers: config.headers,
    signal: abortController.signal,
  },
  authProvider: this.createOAuthProvider(oauthState),
});

// Fallback: SSE transport
this.transport = new SSEClientTransport(url, {
  requestInit: {
    headers: config.headers,
    signal: abortController.signal,
  },
  authProvider: this.createOAuthProvider(oauthState),
});

await client.connect(this.transport, {
  maxTotalTimeout: MCP_MAX_TOTAL_TIMEOUT,
});
```

**Strategy**: Try StreamableHTTP first, fallback to SSE on failure

#### Stdio Transport (Client-side)
**File**: `src/lib/ai/mcp/create-mcp-client.ts` (Lines 202-230)

```typescript
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

this.transport = new StdioClientTransport({
  command: config.command,
  args: config.args,
  env: Object.entries({ ...process.env, ...config.env }).reduce(
    (acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    },
    {} as Record<string, string>,
  ),
  cwd: process.cwd(),
});

await client.connect(this.transport, {
  maxTotalTimeout: MCP_MAX_TOTAL_TIMEOUT,
});
```

**Important**: Stdio disabled on Vercel environments (line 204-206)

### 3. Tool Definition Format

**File**: `src/types/mcp.ts` (Lines 32-40)

```typescript
export type MCPToolInfo = {
  name: string;
  description: string;
  inputSchema?: {
    type?: any;
    properties?: Record<string, any>;
    required?: string[];
  };
};
```

**Client Discovery**: Tools are discovered via `client.listTools()` (line 343)

```typescript
// src/lib/ai/mcp/create-mcp-client.ts:340-353
async updateToolInfo() {
  if (this.status === "connected" && this.client) {
    this.logger.info("Updating tool info");
    const toolResponse = await this.client.listTools();
    this.toolInfo = toolResponse.tools.map(
      (tool) =>
        ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        }) as MCPToolInfo,
    );
  }
}
```

### 4. Request Handler Pattern (NOT USED - SDK Handles Automatically)

**Important Finding**: The codebase does NOT manually implement `ListToolsRequestSchema` or `CallToolRequestSchema` handlers. The `McpServer` class from SDK handles all protocol-level requests automatically when you use `server.tool()`.

**Evidence**: Searching for these schemas returns zero results. The SDK abstracts away the JSON-RPC protocol layer.

### 5. Tool Call Proxy Pattern

**File**: `src/lib/ai/mcp/create-mcp-clients-manager.ts` (Lines 264-301)

```typescript
async toolCall(id: string, toolName: string, input: unknown) {
  return safe(() => this.getClient(id))
    .map((client) => {
      if (!client) throw new Error(`Client ${id} not found`);
      return client.client;
    })
    .map((client) => client.callTool(toolName, input))
    .map((res) => {
      if (res?.content && Array.isArray(res.content)) {
        // Parse JSON text content
        const parsedResult = {
          ...res,
          content: res.content.map((c: any) => {
            if (c?.type === "text" && c?.text) {
              const parsed = safeJSONParse(c.text);
              return {
                type: "text",
                text: parsed.success ? parsed.value : c.text,
              };
            }
            return c;
          }),
        };
        return parsedResult;
      }
      return res;
    })
    .ifFail((err) => {
      return {
        isError: true,
        error: {
          message: errorToString(err),
          name: err?.name || "ERROR",
        },
        content: [],
      };
    })
    .unwrap();
}
```

**Signature**: `toolCall(id: string, toolName: string, input: unknown)`

**Error Handling**: Uses `ts-safe` library for error transformation to MCP error format

**Call Result Schema** (Lines 232-239 in `src/types/mcp.ts`):
```typescript
export const CallToolResultSchema = z.object({
  _meta: z.object({}).passthrough().optional(),
  content: z.array(ContentUnion).default([]),
  structuredContent: z.object({}).passthrough().optional(),
  isError: z.boolean().optional(),
});
```

### 6. Error Handling Approaches

#### Client-Side Tool Call Error Handling
**File**: `src/lib/ai/mcp/create-mcp-client.ts` (Lines 355-413)

```typescript
async callTool(toolName: string, input?: unknown) {
  const id = generateUUID();
  this.inProgressToolCallIds.push(id);

  const execute = async () => {
    const client = await this.connect();
    if (this.status === "authorizing") {
      throw new Error("OAuth authorization required. Try Refresh MCP Client");
    }
    return client?.callTool({
      name: toolName,
      arguments: input as Record<string, unknown>,
    });
  };

  return safe(() => this.logger.info("tool call", toolName))
    .ifOk(() => this.scheduleAutoDisconnect())
    .map(() => execute())
    .ifFail(async (err) => {
      // Handle transport closure with reconnection
      if (err?.message?.includes("Transport is closed")) {
        this.logger.info("Transport is closed, reconnecting...");
        await this.disconnect();
        return execute();
      }
      throw err;
    })
    .ifOk((v) => {
      if (isNull(v)) {
        throw new Error("Tool call failed with null");
      }
      return v;
    })
    .ifOk(() => this.scheduleAutoDisconnect())
    .watch(() => {
      // Cleanup tracking
      this.inProgressToolCallIds = this.inProgressToolCallIds.filter(
        (toolId) => toolId !== id,
      );
    })
    .watch((status) => {
      // Log errors
      if (!status.isOk) {
        this.logger.error("Tool call failed", toolName, status.error);
      } else if (status.value?.isError) {
        this.logger.error(
          "Tool call failed content",
          toolName,
          status.value.content,
        );
      }
    })
    .ifFail((err) => {
      // Transform to MCP error format
      return {
        isError: true,
        error: {
          message: errorToString(err),
          name: err?.name || "ERROR",
        },
        content: [],
      };
    })
    .unwrap();
}
```

**Error Categories**:
1. **Transport Errors**: Auto-reconnect on "Transport is closed"
2. **OAuth Errors**: Throw with specific message for UI handling
3. **Null Results**: Converted to error
4. **Generic Errors**: Transformed to `{ isError: true, error, content: [] }` format

#### OAuth Error Handling
**File**: `src/lib/ai/mcp/create-mcp-client.ts` (Lines 249-294)

```typescript
// Custom error class for OAuth flow
class OAuthAuthorizationRequiredError extends Error {
  constructor(public authorizationUrl: URL) {
    super("OAuth user authorization required");
    this.name = "OAuthAuthorizationRequiredError";
  }
}

// Error detection
function isUnauthorized(error: any): boolean {
  return (
    error instanceof UnauthorizedError ||
    error?.status === 401 ||
    error?.message?.includes("401") ||
    error?.message?.includes("Unauthorized") ||
    error?.message?.includes("invalid_token") ||
    error?.message?.includes("HTTP 401")
  );
}

// Retry with OAuth on unauthorized
if (isUnauthorized(streamableHttpError) && !this.needOauthProvider) {
  this.logger.info(
    "OAuth authentication required, retrying with OAuth provider",
  );
  this.needOauthProvider = true;
  this.locker.unlock();
  await this.disconnect();
  return this.connect(oauthState); // Recursive call with OAuth
}
```

## Considerations

### 1. SDK Abstraction Level
- **HIGH-LEVEL API**: The SDK provides `McpServer` class with `server.tool()` for registration
- **NO LOW-LEVEL HANDLERS**: Do NOT manually implement request schema handlers
- **AUTOMATIC PROTOCOL**: JSON-RPC and MCP protocol handled by SDK internally
- **RECOMMENDATION**: Use `server.tool()` pattern for gateway implementation

### 2. Transport Selection
- **Server-side**: Only `StdioServerTransport` is used in existing servers
- **Client-side**: Three transports available (StreamableHTTP, SSE, Stdio)
- **Gateway Implication**: Gateway server likely needs HTTP/SSE transport for remote access
- **SDK Import Path**: `@modelcontextprotocol/sdk/server/sse.js` (SSE server transport exists)

### 3. Tool Registration Lifecycle
- Tools are registered synchronously via `server.tool()` before `server.connect()`
- No dynamic tool addition/removal after connection
- **Gateway Challenge**: Need to filter tools at registration time or proxy ListTools response

### 4. Error Handling Strategy
- All errors transformed to `{ isError: true, error, content: [] }` format
- Transport errors trigger auto-reconnect
- OAuth errors require user interaction
- **Gateway Requirement**: Must preserve this error format when proxying

### 5. Authentication Integration
- OAuth provider pattern used for remote MCP servers
- `PgOAuthClientProvider` stores state in PostgreSQL
- Multi-instance support via state adoption
- **Gateway Decision**: May need OAuth for gateway endpoint itself

### 6. mcpClientsManager Integration
- **Singleton Pattern**: `globalThis.__mcpClientsManager__` (line 10-25 in `src/lib/ai/mcp/mcp-manager.ts`)
- **Storage Abstraction**: File-based or DB-based config storage
- **Tool Discovery**: Automatic via `client.listTools()` on connection
- **Tool Execution**: Via `toolCall(id, toolName, input)` or `toolCallByServerName(serverName, toolName, input)`

### 7. Content Types Supported
**File**: `src/types/mcp.ts` (Lines 174-230)

Supported content types:
- `text`: Plain text responses
- `image`: Base64-encoded images with mimeType
- `audio`: Base64-encoded audio with mimeType
- `resource_link`: Links to resources
- `resource`: Embedded resources (text or blob)

### 8. Connection Management
- Auto-disconnect after 30 minutes (default, line 59 in manager)
- Tracks in-progress tool calls to prevent premature disconnect (lines 80-82, 166-177)
- Debounced disconnect scheduling (line 163-177)

## Next Steps

### Gateway Server Implementation Approach

Based on findings, recommended approach:

1. **Create HTTP/SSE MCP Server**:
   ```typescript
   import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
   // NOTE: Check SDK docs for SSE server transport import

   const gatewayServer = new McpServer({
     name: `gateway-${presetSlug}`,
     version: "1.0.0",
   });
   ```

2. **Dynamic Tool Registration**:
   - Query preset configuration from DB
   - For each allowed tool, register via `server.tool()`
   - Proxy tool execution to `mcpClientsManager.toolCall()`

3. **Transport Setup**:
   - Investigate SSE server transport availability in SDK
   - May need to use streamable HTTP if SSE server unavailable
   - Consider stdio for local development/testing

4. **Error Proxying**:
   - Catch errors from `mcpClientsManager.toolCall()`
   - Preserve `{ isError, error, content }` format
   - Add gateway-specific metadata to `_meta` field

5. **Authentication**:
   - Integrate with Better Auth for gateway access control
   - Use preset ACL to validate requests
   - Consider OAuth provider pattern for gateway itself

### Open Questions

1. **SSE Server Transport**: Does `@modelcontextprotocol/sdk` provide SSE server transport or only client?
2. **Dynamic Tools**: Can tools be added after `server.connect()` or must all be pre-registered?
3. **Tool Filtering**: Should filtering happen at registration or at ListTools response interception?
4. **Metrics**: How to capture tool call metrics without interfering with MCP protocol?

### Recommended Investigation

1. Check SDK documentation for server-side transports beyond Stdio
2. Examine `@modelcontextprotocol/sdk/server/sse.js` export (if exists)
3. Review SDK source for dynamic tool registration support
4. Test if `server.tool()` can be called multiple times with same name (for updates)
