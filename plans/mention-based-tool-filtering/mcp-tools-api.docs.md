# MCP Tools API Research

## Summary
The MCP clients manager provides a tools() method that returns a flat object of VercelAI-compatible tools keyed by sanitized tool IDs. Tools are created using a tag-based pattern, include MCP-specific metadata fields, and can be filtered by mentions or allowed servers. Tool execution goes through mcpClientsManager.toolCall() which handles client retrieval, connection management, and error handling.

## Key Components

- `/compose/better-chatbot/src/lib/ai/mcp/create-mcp-clients-manager.ts`: Core MCPClientsManager class with tools() and toolCall() methods
- `/compose/better-chatbot/src/lib/ai/mcp/mcp-tool-id.ts`: Tool ID sanitization and creation utilities
- `/compose/better-chatbot/src/types/mcp.ts`: Type definitions for VercelAIMcpTool and related types
- `/compose/better-chatbot/src/lib/tag.ts`: Generic tag-based type system for runtime type checking
- `/compose/better-chatbot/src/app/api/chat/shared.chat.ts`: Tool filtering and loading utilities
- `/compose/better-chatbot/src/lib/ai/mcp/create-mcp-client.ts`: Individual MCPClient with callTool() method

## Data Structures

### 1. tools() Return Type

**Signature**: `async tools(): Promise<Record<string, VercelAIMcpTool>>`

**Structure**:
```typescript
{
  "servername_toolname": {
    description: string,
    inputSchema: JSONSchema7,
    execute: (params, options) => Promise<CallToolResult>,
    _mcpServerName: string,
    _mcpServerId: string,
    _originToolName: string,
    __$ref__: "mcp"  // Tag discriminator
  },
  // ... more tools
}
```

**Key Details** (lines 114-152):
- Returns a **flat object** keyed by tool ID (not an array)
- Keys are generated via `createMCPToolId(clientName, tool.name)`
- Only includes clients with `client.client?.toolInfo?.length > 0`
- Each tool is created via `VercelAIMcpToolTag.create()` which adds the `__$ref__: "mcp"` discriminator
- Tools are reduced from all clients into a single object

### 2. Tool ID Format

**Function**: `createMCPToolId(serverName: string, toolName: string)`
**Location**: `/compose/better-chatbot/src/lib/ai/mcp/mcp-tool-id.ts` (lines 24-49)

**Format**: `{sanitizedServerName}_{sanitizedToolName}`

**Sanitization Rules**:
1. Replace non-alphanumeric chars (except `_`, `.`, `-`) with `_`
2. Ensure starts with letter or underscore
3. Truncate to 124 characters max
4. If combined length exceeds 124, allocate space proportionally between server and tool names

**Examples**:
- `filesystem_read_file`
- `github_create_issue`
- `my-server_my-tool` (dashes preserved)

**Extraction**: `extractMCPToolId(toolId)` returns `{ serverName, toolName }` by splitting on first `_`

### 3. VercelAIMcpTool Type

**Definition** (`/compose/better-chatbot/src/types/mcp.ts`, lines 80-84):
```typescript
export type VercelAIMcpTool = Tool & {
  _mcpServerName: string;
  _mcpServerId: string;
  _originToolName: string;
};
```

**Metadata Fields**:
- `_mcpServerName`: Human-readable server name (e.g., "filesystem")
- `_mcpServerId`: Internal server ID (UUID from database or server name)
- `_originToolName`: Original tool name from MCP server (before sanitization)
- `__$ref__`: "mcp" (added by tag system, not in type definition)

**Base Tool Type** (from Vercel AI SDK):
- `description: string`
- `inputSchema: JSONSchema7`
- `execute?: (params, options) => Promise<any>`

### 4. VercelAIMcpToolTag

**Implementation** (`/compose/better-chatbot/src/lib/tag.ts`, lines 37-39):
```typescript
export const VercelAIMcpToolTag = tag<VercelAIMcpTool>("mcp");
```

**Tag Pattern**:
- `tag()` creates a `TagBuilder` with discriminator value "mcp"
- `TagBuilder.create(data)`: Adds `__$ref__: "mcp"` to data object
- `TagBuilder.isMaybe(value)`: Type guard checking for `__$ref__ === "mcp"`
- `TagBuilder.unwrap(value)`: Removes `__$ref__` field

**Usage in tools()** (line 127):
```typescript
VercelAIMcpToolTag.create({
  description: tool.description,
  inputSchema: jsonSchema(tool.inputSchema),
  _originToolName: tool.name,
  _mcpServerName: clientName,
  _mcpServerId: id,
  execute: (params, options) => this.toolCall(id, tool.name, params)
})
```

## Tool Filtering Patterns

### 5. loadMcpTools Function

**Location**: `/compose/better-chatbot/src/app/api/chat/shared.chat.ts` (lines 396-407)

**Signature**:
```typescript
export const loadMcpTools = (opt?: {
  mentions?: ChatMention[];
  allowedMcpServers?: Record<string, AllowedMCPServer>;
}) => Promise<Record<string, VercelAIMcpTool>>
```

**Logic**:
1. Calls `mcpClientsManager.tools()` to get all tools
2. If `mentions` provided: filters via `filterMCPToolsByMentions()`
3. Else: filters via `filterMCPToolsByAllowedMCPServers()`
4. Returns empty object on error (via `.orElse({})`)

### Filter by Mentions

**Function**: `filterMCPToolsByMentions(tools, mentions)`
**Lines**: 45-78

**Strategy**:
1. Extract mcpTool and mcpServer mentions
2. Build `metionsByServer` map:
   - For `mcpServer` mention: include ALL tools from that server
   - For `mcpTool` mention: include specific tool by name
3. Filter tools where:
   - `_mcpServerId` exists in `metionsByServer`
   - `_originToolName` is in the allowed tools list

**Example**:
```typescript
// Mentions: [{ type: "mcpServer", serverId: "fs-1" }]
// Result: All tools from server "fs-1"

// Mentions: [{ type: "mcpTool", serverId: "fs-1", name: "read_file" }]
// Result: Only "fs-1_read_file" tool
```

### Filter by Allowed Servers

**Function**: `filterMCPToolsByAllowedMCPServers(tools, allowedMcpServers)`
**Lines**: 80-93

**Strategy**:
1. If no `allowedMcpServers` or empty: return empty object (explicit filtering)
2. Filter tools where:
   - `allowedMcpServers[_mcpServerId]?.tools` exists
   - `_originToolName` is in the `tools` array

**AllowedMCPServer Type** (lines 20-23):
```typescript
export type AllowedMCPServer = {
  tools: string[]; // Array of tool names
};
```

## Tool Execution

### 6. toolCall() Method

**Location**: `/compose/better-chatbot/src/lib/ai/mcp/create-mcp-clients-manager.ts` (lines 264-301)

**Signature**:
```typescript
async toolCall(
  id: string,
  toolName: string,
  input: unknown
): Promise<CallToolResult>
```

**Parameters**:
- `id`: MCP server ID (from `_mcpServerId`)
- `toolName`: Original tool name (from `_originToolName`)
- `input`: Tool arguments (passed as-is)

**Return Type** (`/compose/better-chatbot/src/types/mcp.ts`, lines 232-239):
```typescript
export type CallToolResult = {
  _meta?: Record<string, any>;
  content: Array<TextContent | ImageContent | AudioContent | ResourceLinkContent | ResourceContent>;
  structuredContent?: Record<string, any>;
  isError?: boolean;
  error?: { message: string; name: string }; // Added in error handling
};
```

**Execution Flow**:
1. Get client via `this.getClient(id)` (auto-reconnects if needed)
2. Call `client.client.callTool(toolName, input)`
3. Parse JSON in text content if possible
4. On error: Return `{ isError: true, error: {...}, content: [] }`

**Error Handling** (lines 290-299):
- Wraps all errors in safe() monad
- Converts error to `{ message, name }` object
- Always returns a CallToolResult (never throws)

### 7. MCPClient.callTool()

**Location**: `/compose/better-chatbot/src/lib/ai/mcp/create-mcp-client.ts` (lines 355-413)

**Features**:
- Tracks in-progress tool calls (prevents auto-disconnect)
- Auto-reconnects if transport is closed
- Schedules auto-disconnect after completion
- Validates non-null result
- Logs all calls and failures

**Call Flow**:
1. Generate unique ID, add to `inProgressToolCallIds`
2. `await this.connect()` - ensures connection
3. Check if status is "authorizing" (OAuth required)
4. Call `client.callTool({ name: toolName, arguments: input })`
5. Handle "Transport is closed" error with reconnect
6. Remove ID from `inProgressToolCallIds`
7. Schedule auto-disconnect

## Client Metadata

### 8. getClients() Return Structure

**Location**: `/compose/better-chatbot/src/lib/ai/mcp/create-mcp-clients-manager.ts` (lines 229-235)

**Signature**:
```typescript
async getClients(): Promise<Array<{
  id: string;
  client: MCPClient;
}>>
```

**Structure**:
```typescript
[
  {
    id: "server-uuid-123",
    client: MCPClient {
      // Public methods:
      getInfo(): MCPServerInfo,
      connect(oauthState?: string): Promise<Client | undefined>,
      disconnect(): Promise<void>,
      callTool(toolName: string, input?: unknown): Promise<CallToolResult>,
      updateToolInfo(): Promise<void>,
      finishAuth(code: string, state: string): Promise<void>,
      getAuthorizationUrl(): URL | undefined,

      // Public properties:
      toolInfo: MCPToolInfo[],
      status: "connected" | "disconnected" | "loading" | "authorizing"
    }
  },
  // ... more clients
]
```

**MCPToolInfo Type** (lines 32-40):
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

**MCPServerInfo Type** (lines 42-63):
```typescript
export type MCPServerInfo = {
  id: string;
  name: string;
  config?: MCPServerConfig; // Optional - hidden from non-owners
  visibility: "public" | "private";
  error?: unknown;
  enabled: boolean;
  userId: string;
  status: "connected" | "disconnected" | "loading" | "authorizing";
  toolInfo: MCPToolInfo[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
  userName?: string | null;
  userAvatar?: string | null;
  description?: string;
  icon?: {
    value?: string;
    style?: { backgroundColor?: string };
  };
};
```

## Implementation Patterns

### Tool Loading in Chat API

**Location**: `/compose/better-chatbot/src/app/api/chat/route.ts` (lines 207-220)

**Pattern**:
```typescript
const mcpClients = await mcpClientsManager.getClients();
const mcpTools = await mcpClientsManager.tools();

const MCP_TOOLS = await safe()
  .map(errorIf(() => !isToolCallAllowed && "Not allowed"))
  .map(() => loadMcpTools({ mentions, allowedMcpServers }))
  .orElse({});
```

**Key Points**:
- Tools are only loaded if `isToolCallAllowed` is true
- Filtering happens in loadMcpTools() based on mentions or allowedMcpServers
- Errors result in empty tools object (no crash)
- All three tool sources (MCP, Workflow, App Default) are loaded in parallel

### Execute Function Binding

**Location**: `/compose/better-chatbot/src/lib/ai/mcp/create-mcp-clients-manager.ts` (lines 139-142)

```typescript
execute: (params, options: ToolCallOptions) => {
  options?.abortSignal?.throwIfAborted();
  return this.toolCall(id, tool.name, params);
}
```

**Details**:
- Closure captures `id` (server ID) and `tool.name` (original name)
- Vercel AI SDK calls execute with `(params, { toolCallId, abortSignal, messages })`
- Abort signal is checked before execution
- Returns Promise of CallToolResult

### Tool Customization System

**Location**: `/compose/better-chatbot/src/app/api/chat/shared.chat.ts` (lines 180-220)

**Function**: `filterMcpServerCustomizations(tools, mcpServerCustomization)`

**Purpose**: Filters customization prompts to only include those for loaded tools

**Structure**:
```typescript
Record<string, McpServerCustomizationsPrompt> where
McpServerCustomizationsPrompt = {
  name: string;
  id: string; // server ID
  prompt?: string; // Server-level custom prompt
  tools?: {
    [toolName: string]: string; // Tool-level custom prompts
  };
}
```

## Considerations

### Tool ID Collisions
- Tool IDs are sanitized to 124 chars, proportionally allocated
- If two servers have similar names AND similar tool names, collisions are possible
- Extraction via `extractMCPToolId()` splits on first `_`, so tool names with underscores work correctly

### Connection Management
- Tools are auto-generated from connected clients
- If a client disconnects, its tools are removed from the next `tools()` call
- Auto-disconnect timer is reset on each `toolCall()` (default 30 minutes)
- In-progress tool calls prevent auto-disconnect

### Filtering Logic Edge Cases
- `loadMcpTools()` with NO mentions and NO allowedMcpServers returns EMPTY object (not all tools)
- `filterMCPToolsByMentions()` with empty mentions returns ALL tools
- `filterMCPToolsByAllowedMCPServers()` with empty allowedMcpServers returns EMPTY object
- This asymmetry is intentional: mentions are additive, allowedMcpServers is restrictive

### Error Handling Strategy
- `toolCall()` never throws - always returns CallToolResult with isError flag
- Tool filtering functions use safe() monad with `.orElse({})` fallback
- Connection errors trigger auto-reconnect in MCPClient.callTool()
- OAuth authorization errors throw to bubble up to UI

### Tool Metadata Usage
- `_mcpServerId` is used for toolCall() routing and filtering
- `_originToolName` is used for actual MCP protocol callTool request
- `_mcpServerName` is for display purposes only (not used in execution)
- Tool ID (the object key) is used by Vercel AI SDK for tool selection

## Next Steps

### For Implementing Mention-Based Tool Filtering
1. Use `loadMcpTools({ mentions })` pattern from shared.chat.ts
2. Build mentions array from UI selections: `{ type: "mcpTool" | "mcpServer", serverId, name? }`
3. Pass mentions to chat API via request body
4. Tools will be automatically filtered in the execute() handler

### For Building Tool Selection UI
1. Fetch all tools via `mcpClientsManager.tools()`
2. Group by `_mcpServerId` or `_mcpServerName` for hierarchical display
3. Display `_originToolName` (original name) and `description` to users
4. Store `_mcpServerId` and `_originToolName` in mention objects
5. Use `VercelAIMcpToolTag.isMaybe(tool)` to distinguish MCP tools from other tool types

### For Debugging Tool Execution
1. Check `mcpClientsManager.getClients()` for client status
2. Verify `client.toolInfo` contains expected tools
3. Check tool ID generation with `createMCPToolId(serverName, toolName)`
4. Inspect CallToolResult.isError and CallToolResult.error fields
5. Check MCPClient logs for connection and tool call details
