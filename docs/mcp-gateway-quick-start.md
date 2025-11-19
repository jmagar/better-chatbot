# MCP Gateway Quick Start Guide

This guide will help you quickly set up and connect to your MCP Gateway.

## 5-Minute Setup

### 1. Find Your User ID

1. Sign in to Better Chatbot
2. Go to Settings → Account
3. Copy your User ID

### 2. Create or Select a Preset (Optional)

If you want to expose specific tools only:

1. Go to Settings → MCP Gateway
2. Click "Create Preset"
3. Name it (e.g., "My Tools")
4. Select which MCP servers to include
5. Save and note the preset slug

### 3. Get Your Gateway URL

Choose one of these endpoints:

**All Tools:**
```
https://your-domain.com/api/mcp-gateway/[YOUR_USER_ID]/mcp
```

**Specific Preset:**
```
https://your-domain.com/api/mcp-gateway/[YOUR_USER_ID]/mcp/[PRESET_SLUG]
```

### 4. Configure Claude Desktop

**macOS/Linux:**
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows:**
Edit `%APPDATA%\Claude\claude_desktop_config.json`

Add this configuration:

```json
{
  "mcpServers": {
    "better-chatbot": {
      "url": "https://your-domain.com/api/mcp-gateway/YOUR_USER_ID/mcp",
      "transport": "streamable-http"
    }
  }
}
```

Replace `YOUR_USER_ID` with your actual user ID.

### 5. Restart Claude Desktop

1. Quit Claude Desktop completely
2. Reopen Claude Desktop
3. Start a new conversation
4. Your tools should be available!

## Verify It's Working

### Method 1: Check in Claude Desktop

In a Claude conversation, ask:
```
What MCP tools do you have available?
```

Claude should list tools from your connected MCP servers.

### Method 2: Use MCP Inspector

```bash
npx @modelcontextprotocol/inspector https://your-domain.com/api/mcp-gateway/YOUR_USER_ID/mcp
```

This opens a web interface showing all available tools.

## Common Issues

### "No tools available"

- ✅ Verify your MCP servers are connected in Better Chatbot
- ✅ Check that you're signed in
- ✅ Restart Claude Desktop

### "Connection failed"

- ✅ Verify your user ID is correct
- ✅ Check your internet connection
- ✅ Make sure you're using `https://` not `http://`

### "Authentication required"

- ✅ Sign in to Better Chatbot in your browser
- ✅ Try the URL in your browser first to authenticate
- ✅ Restart Claude Desktop after authentication

## Next Steps

- **Create Multiple Presets**: Organize tools by use case
- **Explore Tool Filtering**: Expose only the tools you need
- **Set Up for Multiple Clients**: Connect Cursor, other IDEs
- **Review Documentation**: See [full documentation](./mcp-gateway.md)

## Example Configurations

### Development Setup

```json
{
  "mcpServers": {
    "dev-tools": {
      "url": "https://app.example.com/api/mcp-gateway/user123/mcp/dev-tools",
      "transport": "streamable-http"
    }
  }
}
```

### Multiple Presets

```json
{
  "mcpServers": {
    "dev": {
      "url": "https://app.example.com/api/mcp-gateway/user123/mcp/dev",
      "transport": "streamable-http"
    },
    "prod": {
      "url": "https://app.example.com/api/mcp-gateway/user123/mcp/prod",
      "transport": "streamable-http"
    }
  }
}
```

## Testing Your Setup

Try these commands in Claude:

1. **List tools**: "What MCP tools are available?"
2. **Use a tool**: "Use the [tool name] to [action]"
3. **Check status**: "Show me details about the available tools"

## Getting Help

- **Full Documentation**: [mcp-gateway.md](./mcp-gateway.md)
- **MCP Protocol Docs**: https://modelcontextprotocol.io
- **SDK Repository**: https://github.com/modelcontextprotocol/sdk
