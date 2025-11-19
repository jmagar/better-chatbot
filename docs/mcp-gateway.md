# MCP Gateway Documentation

## Overview

The MCP Gateway allows you to expose tools from your connected MCP servers as a unified MCP server endpoint. This enables external MCP clients like Claude Desktop, Cursor, and other MCP-compatible applications to connect to your Better Chatbot instance and access all your configured tools through a single endpoint.

## Architecture

```
External MCP Clients (Claude Desktop, Cursor, etc.)
            ↓
    OAuth Authentication (Google)
            ↓
StreamableHTTP Transport (@modelcontextprotocol/sdk)
            ↓
      MCPProtocolServer
     - tools/list handler
     - tools/call handler
            ↓
       GatewayService
     - Tool filtering
     - Circuit breaker
            ↓
     MCPClientsManager
            ↓
   Backend MCP Servers
```

## Key Features

- **OAuth Authentication**: Secure access using Google OAuth through your existing Better Chatbot account
- **Preset Support**: Create multiple gateway configurations with different tool sets
- **Tool Filtering**: Control which MCP servers and tools are exposed
- **Circuit Breaker**: Built-in resilience with automatic failure handling
- **Stateful Sessions**: Per-user gateway servers cached for performance

## Getting Started

### Prerequisites

1. A Better Chatbot account
2. One or more MCP servers connected to your account
3. An external MCP client (Claude Desktop, Cursor, etc.)

### Step 1: Create a Gateway Preset

Gateway presets allow you to configure which tools are exposed through your gateway endpoint.

1. Navigate to your Better Chatbot settings
2. Go to the "MCP Gateway" section
3. Create a new preset or use an existing one
4. Select which MCP servers to include
5. Optionally, filter specific tools from each server

### Step 2: Get Your Gateway URL

Your gateway endpoints follow this pattern:

- **All tools**: `https://your-domain.com/api/mcp-gateway/[YOUR_USER_ID]/mcp`
- **Preset-specific**: `https://your-domain.com/api/mcp-gateway/[YOUR_USER_ID]/mcp/[PRESET_SLUG]`

Replace:
- `[YOUR_USER_ID]` with your user ID (found in your account settings)
- `[PRESET_SLUG]` with your preset's slug (e.g., "my-dev-tools")

### Step 3: Configure Your MCP Client

#### Claude Desktop

Add this configuration to your Claude Desktop config file (usually at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "better-chatbot-all": {
      "url": "https://your-domain.com/api/mcp-gateway/[YOUR_USER_ID]/mcp",
      "transport": "streamable-http"
    }
  }
}
```

Or for a specific preset:

```json
{
  "mcpServers": {
    "better-chatbot-dev": {
      "url": "https://your-domain.com/api/mcp-gateway/[YOUR_USER_ID]/mcp/dev-tools",
      "transport": "streamable-http"
    }
  }
}
```

#### Cursor IDE

Add this to your Cursor MCP configuration:

```json
{
  "mcp": {
    "servers": {
      "better-chatbot": {
        "command": "npx",
        "args": [
          "-y",
          "@modelcontextprotocol/client",
          "connect",
          "https://your-domain.com/api/mcp-gateway/[YOUR_USER_ID]/mcp"
        ]
      }
    }
  }
}
```

### Step 4: Authenticate

When you first connect, you'll need to authenticate:

1. Your MCP client will attempt to connect to the gateway
2. You'll be redirected to sign in with Google (if not already signed in)
3. After authentication, your session will be established
4. The MCP client will automatically reconnect and list available tools

## Testing Your Gateway

### Using MCP Inspector

The MCP Inspector is a development tool for testing MCP servers:

```bash
npx @modelcontextprotocol/inspector https://your-domain.com/api/mcp-gateway/[YOUR_USER_ID]/mcp
```

This will:
1. Connect to your gateway
2. List all available tools
3. Allow you to test tool execution
4. Show request/response details

## Gateway Presets

### Creating a Preset

Presets allow you to organize and control tool exposure:

1. **Name**: A descriptive name for your preset (e.g., "Development Tools")
2. **Slug**: URL-friendly identifier (e.g., "dev-tools")
3. **Servers**: Select which MCP servers to include
4. **Tools**: Optionally filter specific tools from each server
5. **Visibility**: Control who can access this preset

### Preset Configuration

Each preset can configure:

- **Enabled Servers**: Choose which connected MCP servers to expose
- **Tool Filtering**: Granular control over which tools are available
  - Empty list = all tools from the server
  - Specific tool names = only those tools
- **Access Control**: Set visibility (private, public, invite-only)

### Example Preset Configurations

**Development Preset:**
```
Name: Development Tools
Slug: dev-tools
Servers:
  - GitHub MCP (all tools)
  - Filesystem MCP (read, write, list)
  - Database MCP (query, schema)
```

**Production Preset:**
```
Name: Production Tools
Slug: prod-tools
Servers:
  - GitHub MCP (read-only tools)
  - Monitoring MCP (all tools)
```

## Authentication & Security

### OAuth Flow

The gateway uses OAuth 2.0 with Google as the identity provider:

1. Client connects to gateway endpoint
2. Gateway checks for valid session
3. If no session, redirects to Google OAuth
4. User authenticates with Google
5. Gateway creates session and returns to client
6. Client reconnects with session cookie

### Session Management

- Sessions are stateful and stored server-side
- Each user has their own gateway server instance
- Sessions persist across client reconnections
- Automatic session refresh when needed

### Security Best Practices

1. **HTTPS Only**: Always use HTTPS in production
2. **Session Cookies**: Use secure, HTTP-only cookies
3. **Access Control**: Use preset visibility settings appropriately
4. **Tool Filtering**: Only expose necessary tools
5. **Monitoring**: Review gateway metrics and events

## API Endpoints

### Gateway Protocol Endpoint

**POST /api/mcp-gateway/[userId]/mcp**
- Execute MCP protocol requests
- Supports `tools/list` and `tools/call` methods
- Requires authentication

**GET /api/mcp-gateway/[userId]/mcp**
- Server-Sent Events endpoint
- Real-time notifications
- Requires authentication

**DELETE /api/mcp-gateway/[userId]/mcp**
- Terminate gateway session
- Clear cached server instance
- Requires authentication

### Preset Endpoint

**POST /api/mcp-gateway/[userId]/mcp/[preset]**
- Same as above but filtered by preset
- Only exposes tools from the specified preset
- Requires authentication

## Troubleshooting

### Connection Issues

**Problem**: Client can't connect to gateway

**Solutions**:
1. Verify your user ID is correct
2. Check that you're signed in to Better Chatbot
3. Ensure your MCP servers are connected
4. Try clearing your browser cookies and re-authenticating

**Problem**: "Preset not found" error

**Solutions**:
1. Verify the preset slug is correct
2. Check that the preset belongs to your user
3. Ensure the preset status is "active"

### Authentication Issues

**Problem**: Repeated authentication prompts

**Solutions**:
1. Clear your browser cache and cookies
2. Check that cookies are enabled
3. Verify you're using HTTPS in production
4. Check session timeout settings

**Problem**: "Forbidden" or "Unauthorized" errors

**Solutions**:
1. Sign out and sign in again
2. Verify you're accessing your own user ID
3. Check that your Google account is valid
4. Review server logs for details

### Tool Execution Issues

**Problem**: Tool not found

**Solutions**:
1. Verify the tool is included in your preset
2. Check that the backend MCP server is connected
3. Refresh your MCP client connection
4. Check the circuit breaker status

**Problem**: Tool execution timeout

**Solutions**:
1. Check network connectivity
2. Verify backend MCP server is responding
3. Review circuit breaker thresholds
4. Check tool execution logs

## Monitoring & Metrics

The gateway tracks:

- **Total requests**: Number of MCP protocol requests
- **Tool executions**: Count of tool calls
- **Success rate**: Percentage of successful tool executions
- **Circuit breaker events**: When circuits open/close
- **Session count**: Active gateway sessions

Access metrics through:
1. Gateway metrics table in database
2. Server logs with `MCP-Gateway-API` tag
3. Monitoring dashboard (if configured)

## Advanced Configuration

### Circuit Breaker Settings

The gateway uses a circuit breaker to prevent cascading failures:

- **Error Threshold**: 50% (opens after 50% failures)
- **Volume Threshold**: 10 requests (minimum before opening)
- **Timeout**: 30 seconds for tool execution
- **Reset Timeout**: 30 seconds before retry

### Caching Strategy

Gateway servers are cached per user/preset combination:

- Cache key: `${userId}:${presetSlug || 'all'}`
- Cache invalidation: On DELETE request or configuration change
- Memory-based cache with automatic cleanup

### Performance Optimization

1. **Connection Pooling**: Reuse MCP client connections
2. **Tool Catalog Caching**: Cache tool lists for 5 seconds
3. **Preset Caching**: Cache preset configurations
4. **Request Batching**: Group multiple tool calls when possible

## Limitations

- **Session-based**: Requires stateful server deployment
- **No Offline Mode**: Requires active internet connection
- **Rate Limiting**: Subject to backend MCP server limits
- **Concurrent Requests**: Limited by circuit breaker thresholds

## Support & Resources

- **MCP Protocol**: https://modelcontextprotocol.io/specification
- **SDK Documentation**: https://github.com/modelcontextprotocol/sdk
- **Issue Tracker**: [Your issue tracker URL]
- **Community**: [Your community forum URL]

## Changelog

### Version 1.0.0 (Initial Release)

- OAuth authentication with Google
- Preset-based tool filtering
- StreamableHTTP transport
- Circuit breaker integration
- Session management
- Multi-endpoint support (all tools + preset-specific)
