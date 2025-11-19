# MCP Capabilities Research: Resources, Prompts, Sampling, and Elicitation

## Executive Summary

This document provides comprehensive research findings on Model Context Protocol (MCP) capabilities beyond basic tools, specifically: **Resources**, **Prompts**, **Sampling (createMessage)**, and **Elicitation**. It also analyzes Vercel AI SDK support for these features.

## 1. MCP Resources

### Overview
Resources expose contextual data (files, schemas, application state) to clients and LLMs. Each resource has a unique URI with metadata (name, title, description, mimeType).

### Key Capabilities
- **List Resources**: `resources/list` - Returns array of available resources with pagination
- **Read Resource**: `resources/read` - Fetches content of specific resource by URI
- **Resource Templates**: Dynamic URI generation with parameters
- **Subscriptions**: Real-time updates via `resources/subscribe` and `resources/unsubscribe`
- **Change Notifications**: `notifications/resources/list_changed` and `notifications/resources/updated`

### Specification
```json
// List Resources Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/list",
  "params": { "cursor": "optional-cursor" }
}

// Response
{
  "resources": [{
    "uri": "file:///project/src/main.rs",
    "name": "main.rs",
    "title": "Main Source File",
    "description": "Application entry point",
    "mimeType": "text/x-rust"
  }],
  "nextCursor": "next-page"
}

// Read Resource Request
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "resources/read",
  "params": { "uri": "file:///project/src/main.rs" }
}

// Response
{
  "contents": [{
    "uri": "file:///project/src/main.rs",
    "mimeType": "text/x-rust",
    "text": "fn main() { println!(\"Hello!\"); }"
  }]
}
```

### TypeScript SDK Support
```typescript
// Client Side
const resources = await client.listResources();
const content = await client.readResource({ uri: "file:///..." });

// Server Side
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

server.resource(
  "user-profile",
  new ResourceTemplate("users://{userId}/profile", { list: undefined }),
  async (uri, { userId }) => ({
    contents: [{ uri: uri.href, text: `Profile for ${userId}` }]
  })
);
```

## 2. MCP Prompts

### Overview
Prompts provide structured templates/workflows for LLM interaction. They accept dynamic arguments, embed resource context, and can be surfaced as UI slash commands.

### Key Capabilities
- **List Prompts**: `prompts/list` - Discover available prompt templates
- **Get Prompt**: `prompts/get` - Retrieve template with arguments
- **Dynamic Arguments**: Required/optional parameters with descriptions
- **Multi-Message Support**: Complex conversation flows
- **Resource Embedding**: Include resource context in prompts
- **Change Notifications**: `notifications/prompts/list_changed`

### Specification
```json
// List Prompts Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "prompts/list",
  "params": { "cursor": "optional-cursor" }
}

// Response
{
  "prompts": [{
    "name": "code_review",
    "description": "Analyze code and suggest improvements",
    "arguments": [{
      "name": "code",
      "description": "Code to review",
      "required": true
    }]
  }]
}

// Get Prompt Request
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "prompts/get",
  "params": {
    "name": "code_review",
    "arguments": { "code": "def hello(): print('world')" }
  }
}

// Response
{
  "description": "Code review prompt",
  "messages": [{
    "role": "user",
    "content": {
      "type": "text",
      "text": "Please review this Python code:\ndef hello():\n print('world')"
    }
  }]
}
```

### TypeScript SDK Support
```typescript
// Client Side
const prompts = await client.listPrompts();
const prompt = await client.getPrompt({
  name: "analyze-code",
  arguments: { language: "python" }
});

// Server Side
server.prompt("code-review", {
  description: "Review code quality",
  arguments: [
    { name: "code", description: "Code to review", required: true },
    { name: "language", description: "Programming language", required: false }
  ]
}, async ({ code, language }) => ({
  messages: [{
    role: "user",
    content: {
      type: "text",
      text: `Review this ${language || 'unknown'} code:\n${code}`
    }
  }]
}));
```

## 3. MCP Sampling (createMessage)

### Overview
Sampling allows MCP servers to request LLM completions from clients. Servers can leverage LLM capabilities without managing API keys, maintaining user control over all context submitted to models.

### Key Capabilities
- **Request Completions**: `sampling/createMessage` - Server asks client to generate message
- **Model Preferences**: Hints for model selection (name, family, cost/speed/intelligence priorities)
- **Human-in-the-Loop**: User review of requests and responses
- **Context Inclusion**: Optional server/all-servers context
- **Multiple Content Types**: Text, images (base64), audio (base64)
- **Sampling Parameters**: temperature, maxTokens, stopSequences, metadata

### Specification
```json
// Sampling Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "sampling/createMessage",
  "params": {
    "messages": [{
      "role": "user",
      "content": {
        "type": "text",
        "text": "What is the capital of France?"
      }
    }],
    "modelPreferences": {
      "hints": [{ "name": "claude-3-sonnet" }],
      "intelligencePriority": 0.8,
      "speedPriority": 0.5,
      "costPriority": 0.3
    },
    "systemPrompt": "You are a helpful assistant.",
    "maxTokens": 100,
    "temperature": 0.7,
    "stopSequences": ["END"],
    "includeContext": "thisServer", // or "allServers" or "none"
    "metadata": { "provider": "anthropic" }
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "role": "assistant",
    "content": {
      "type": "text",
      "text": "The capital of France is Paris."
    },
    "model": "claude-3-sonnet-20240307",
    "stopReason": "endTurn"
  }
}
```

### Flow
1. Server sends `sampling/createMessage` to client
2. Client reviews (user may edit prompt/parameters)
3. Client submits to LLM
4. Client reviews response (user may edit/approve)
5. Client returns result to server

### Security Best Practices
- User must be able to review/edit all sampling requests
- User must be able to review/approve all LLM responses
- Clear indication of which server is requesting sampling
- Option to deny/cancel at any point

## 4. MCP Elicitation

### Overview
Elicitation enables servers to request dynamic input from users, pausing execution until data/confirmation is provided. Implements "human-in-the-loop" workflows for approvals, clarifications, credentials, or contextual augmentation.

### Key Capabilities
- **Form Mode**: Structured data collection with JSON Schema validation
- **URL Mode**: External navigation for sensitive operations
- **User Actions**: accept, decline, cancel
- **Schema Validation**: Client-side validation before submission
- **Security Guidelines**: Sensitive data MUST use URL mode

### Specification
```json
// Elicitation Request (Form Mode)
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "elicitation/create",
  "params": {
    "mode": "form",
    "message": "Please provide deployment credentials",
    "requestedSchema": {
      "type": "object",
      "properties": {
        "apiKey": { "type": "string", "description": "API Key" },
        "region": {
          "type": "string",
          "enum": ["us-east-1", "eu-west-1"],
          "description": "Deployment region"
        }
      },
      "required": ["apiKey", "region"]
    }
  }
}

// Client Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "action": "accept", // or "decline" or "cancel"
    "content": {
      "apiKey": "sk-...",
      "region": "us-east-1"
    }
  }
}

// Elicitation Request (URL Mode)
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "elicitation/create",
  "params": {
    "mode": "url",
    "message": "Please authorize application access",
    "url": "https://example.com/oauth/authorize?..."
  }
}
```

### TypeScript SDK Support
```typescript
// Client Implementation
client.on("elicitation/create", async (params) => {
  if (params.mode === "form") {
    const userInput = await displayFormAndCollectInput(
      params.message,
      params.requestedSchema
    );
    return { action: "accept", content: userInput };
  } else if (params.mode === "url") {
    await openBrowserAndWaitForCallback(params.url);
    return { action: "accept" };
  }
});

// Server Implementation
server.registerTool("deploy", schema, async (args) => {
  if (!args.credentials) {
    return {
      elicitation: {
        mode: "form",
        message: "Please provide deployment credentials",
        requestedSchema: credentialsSchema
      }
    };
  }
  // Execute deployment...
});
```

### Security Requirements
- UI MUST clearly indicate requesting server
- User MUST be able to cancel/decline
- Sensitive data MUST use URL mode (not form mode)
- Client should validate against schema before submission

## 5. Completion (Autocomplete)

### Overview
Enables servers to provide contextual suggestions for tool arguments and resource URIs. Delivers IDE-like experience with filtered, ranked suggestions.

### Specification
```json
// Completion Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "completion/complete",
  "params": {
    "ref": {
      "type": "ref/prompt",
      "name": "add_contact"
    },
    "argument": {
      "name": "country",
      "value": "Uni"
    }
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "completion": {
      "values": ["United States", "United Kingdom", "United Arab Emirates"],
      "total": 3,
      "hasMore": false
    }
  }
}
```

## 6. Vercel AI SDK Integration

### Current Status
- **Experimental MCP Client**: `experimental_createMCPClient` function available
- **Transport Support**: HTTP, SSE, stdio, custom transports
- **Tools**: Full support ✅
- **Resources**: Full support ✅ (recently added/in progress)
- **Prompts**: Full support ✅ (recently added/in progress)
- **Sampling**: Limited/unclear (needs investigation)
- **Elicitation**: Not directly supported (MCP SDK level feature)

### API Methods
```typescript
import { experimental_createMCPClient } from 'ai';

const mcpClient = experimental_createMCPClient({
  transport: 'http',
  url: 'https://mcp-server.example.com'
});

// Available methods
const tools = await mcpClient.tools();
const resources = await mcpClient.listResources();
const resource = await mcpClient.readResource(uri);
const templates = await mcpClient.listResourceTemplates();
const prompts = await mcpClient.listPrompts();
// Sampling and elicitation may not be exposed at AI SDK level
```

### Integration Recommendations
1. Use `@modelcontextprotocol/sdk` Client directly for full protocol support
2. Use Vercel AI SDK's `experimental_createMCPClient` for streamlined tool/resource/prompt access
3. For sampling and elicitation, implement at MCP SDK level with proper client-side handlers
4. Follow human-in-the-loop patterns for security

## 7. Implementation Priorities

### Phase 1: Resources & Prompts (Current Focus)
- ✅ Client support for `listResources()` and `readResource()`
- ✅ Client support for `listPrompts()` and `getPrompt()`
- ✅ Gateway aggregation of resources from multiple servers
- ✅ Gateway aggregation of prompts from multiple servers
- ✅ Server exposure via MCP protocol
- ✅ Comprehensive test coverage

### Phase 2: Sampling (Next)
- ⏳ Client-side sampling handler registration
- ⏳ Human-in-the-loop review UI for sampling requests
- ⏳ Gateway routing of sampling requests
- ⏳ Server exposure of sampling capability
- ⏳ Model preference handling
- ⏳ Context inclusion options

### Phase 3: Elicitation (Future)
- ⏳ Client-side elicitation handlers
- ⏳ Form mode UI with JSON Schema validation
- ⏳ URL mode browser integration
- ⏳ Gateway pass-through of elicitation
- ⏳ Security audit and guidelines
- ⏳ User approval workflows

### Phase 4: Completion (Future)
- ⏳ Argument autocomplete for tools
- ⏳ Resource URI autocomplete
- ⏳ Prompt argument autocomplete
- ⏳ Gateway aggregation of completions
- ⏳ Ranking and filtering logic

## 8. Testing Strategy

### Unit Tests
- Resource listing/reading logic
- Prompt listing/retrieval logic
- Sampling request/response transformation
- Elicitation handler registration
- Completion value filtering

### Integration Tests
- End-to-end resource flow (client → gateway → server)
- End-to-end prompt flow
- Sampling with mock LLM
- Elicitation with mock user input
- Multi-server aggregation

### Security Tests
- Elicitation mode enforcement (sensitive data → URL mode)
- Sampling request review capabilities
- User cancellation flows
- Authorization checks

## 9. Architecture Considerations

### Client Layer
- MCPClient class extensions for resources, prompts, sampling, elicitation
- Handler registration APIs
- Human-in-the-loop UI components

### Gateway Layer
- Resource aggregation across servers
- Prompt aggregation with namespace handling
- Sampling request routing
- Elicitation pass-through
- Circuit breakers for all capabilities

### Server Layer
- Protocol handler registration (resources, prompts, sampling)
- Transport layer integration
- Capability negotiation
- Change notifications

## 10. References

- [MCP Specification - Sampling](https://modelcontextprotocol.io/specification/2025-06-18/client/sampling)
- [MCP Specification - Resources](https://modelcontextprotocol.io/specification/2025-06-18/server/resources)
- [MCP Specification - Prompts](https://modelcontextprotocol.io/specification/2025-03-26/server/prompts)
- [MCP Specification - Elicitation](https://modelcontextprotocol.io/specification/draft/client/elicitation)
- [MCP Specification - Completion](https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/completion)
- [TypeScript SDK - GitHub](https://github.com/modelcontextprotocol/typescript-sdk)
- [Vercel AI SDK - MCP Tools](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools)
- [Vercel AI SDK - MCP Client Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/create-mcp-client)

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-19  
**Status**: Research Complete, Implementation in Progress
