import type { MCPClientsManager } from "@/lib/ai/mcp/create-mcp-clients-manager";
import type { GatewayPresetConfig, VercelAIMcpTool } from "./types";
import CircuitBreaker from "opossum";

// FIX: Add timeout wrapper
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs),
  );
  return Promise.race([promise, timeoutPromise]);
}

export class GatewayService {
  private toolCallBreaker: CircuitBreaker;

  constructor(private mcpManager: MCPClientsManager) {
    // FIX: Add circuit breaker for resilience
    this.toolCallBreaker = new CircuitBreaker(
      async (serverId: string, toolName: string, args: unknown) => {
        return this.mcpManager.toolCall(serverId, toolName, args);
      },
      {
        timeout: 30000, // 30 seconds
        errorThresholdPercentage: 50, // Open after 50% errors
        resetTimeout: 30000, // Try again after 30 seconds
        volumeThreshold: 10, // Min 10 requests before opening
      },
    );

    // Fallback for circuit breaker
    this.toolCallBreaker.fallback(() => ({
      error: "Service temporarily unavailable",
      retryAfter: 30,
    }));
  }

  async getPresetTools(
    config: GatewayPresetConfig,
  ): Promise<Record<string, VercelAIMcpTool>> {
    // Disabled presets return no tools
    if (config.status !== "active") {
      return {};
    }

    // FIX: Add timeout to tools() call (5 seconds)
    const allTools = await withTimeout(
      this.mcpManager.tools(),
      5000,
      "Timeout loading tools catalog",
    );

    const filteredTools: Record<string, VercelAIMcpTool> = {};

    for (const serverConfig of config.servers) {
      // Skip disabled servers
      if (!serverConfig.enabled) continue;

      // Filter tools by server ID
      const serverToolEntries = Object.entries(allTools).filter(
        ([_, tool]) => tool._mcpServerId === serverConfig.mcpServerId,
      );

      // Apply tool name filtering
      for (const [toolId, tool] of serverToolEntries) {
        const isAllowed =
          serverConfig.allowedToolNames.length === 0 || // Empty = all tools
          serverConfig.allowedToolNames.includes(tool._originToolName);

        if (isAllowed) {
          filteredTools[toolId] = tool;
        }
      }
    }

    return filteredTools;
  }

  async executeToolCall(
    serverId: string,
    toolName: string,
    args: unknown,
  ): Promise<unknown> {
    // FIX: Use circuit breaker with timeout (30 seconds)
    return this.toolCallBreaker.fire(serverId, toolName, args);
  }
}
