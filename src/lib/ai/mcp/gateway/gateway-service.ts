import type { MCPClientsManager } from "lib/ai/mcp/create-mcp-clients-manager";
import type { VercelAIMcpTool } from "app-types/mcp";
import type { GatewayPresetConfig } from "./types";
import CircuitBreaker from "opossum";
import globalLogger from "@/lib/logger";

// FIX: Add timeout wrapper with proper cleanup
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(errorMessage)),
      timeoutMs,
    );
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle);
  });
}

export class GatewayService {
  private toolCallBreaker: CircuitBreaker;
  private resourceCallBreaker: CircuitBreaker;
  private promptCallBreaker: CircuitBreaker;
  private logger = globalLogger.withTag("GatewayService");

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

    // Add event listeners for circuit breaker state changes
    this.toolCallBreaker.on("open", () => {
      this.logger.warn(
        "Tool call circuit breaker opened - MCP service degraded",
      );
    });

    this.toolCallBreaker.on("halfOpen", () => {
      this.logger.info(
        "Tool call circuit breaker half-open - testing recovery",
      );
    });

    this.toolCallBreaker.on("close", () => {
      this.logger.info("Tool call circuit breaker closed - service recovered");
    });

    // Fallback for circuit breaker
    this.toolCallBreaker.fallback(() => {
      throw new Error(
        "MCP service temporarily unavailable. Circuit breaker is open. Retry after 30 seconds.",
      );
    });

    // Circuit breaker for resource calls
    this.resourceCallBreaker = new CircuitBreaker(
      async (_serverId: string, _uri: string) => {
        // TODO: Implement resource call through MCP manager
        throw new Error("Resource calls not yet implemented in MCP manager");
      },
      {
        timeout: 15000, // 15 seconds for resources
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        volumeThreshold: 10,
      },
    );

    this.resourceCallBreaker.on("open", () => {
      this.logger.warn(
        "Resource call circuit breaker opened - MCP resource service degraded",
      );
    });

    // Circuit breaker for prompt calls
    this.promptCallBreaker = new CircuitBreaker(
      async (_serverId: string, _promptName: string, _args: unknown) => {
        // TODO: Implement prompt call through MCP manager
        throw new Error("Prompt calls not yet implemented in MCP manager");
      },
      {
        timeout: 10000, // 10 seconds for prompts
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        volumeThreshold: 10,
      },
    );

    this.promptCallBreaker.on("open", () => {
      this.logger.warn(
        "Prompt call circuit breaker opened - MCP prompt service degraded",
      );
    });
  }

  async getPresetTools(
    config: GatewayPresetConfig,
  ): Promise<Record<string, VercelAIMcpTool>> {
    const startTime = Date.now();
    this.logger.debug("Getting preset tools", { presetId: config.id });

    try {
      // Disabled presets return no tools
      if (config.status !== "active") {
        this.logger.warn("Preset is not active", {
          presetId: config.id,
          status: config.status,
        });
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

      const duration = Date.now() - startTime;
      this.logger.info("Loaded preset tools", {
        presetId: config.id,
        toolCount: Object.keys(filteredTools).length,
        duration: `${duration}ms`,
      });

      return filteredTools;
    } catch (error) {
      this.logger.error("Failed to get preset tools", {
        presetId: config.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getPresetResources(config: GatewayPresetConfig): Promise<any[]> {
    this.logger.debug("Getting preset resources", { presetId: config.id });

    try {
      // Disabled presets return no resources
      if (config.status !== "active") {
        this.logger.warn("Preset is not active", {
          presetId: config.id,
          status: config.status,
        });
        return [];
      }

      // TODO: Implement resource listing through MCP manager
      // For now, return empty array as placeholder
      this.logger.info("Resource listing not yet implemented");
      return [];
    } catch (error) {
      this.logger.error("Failed to get preset resources", {
        presetId: config.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async readResource(serverId: string, uri: string): Promise<any> {
    this.logger.debug("Reading resource", { serverId, uri });

    try {
      // Validate inputs
      if (!serverId || typeof serverId !== "string") {
        throw new Error("Invalid serverId: must be non-empty string");
      }
      if (!uri || typeof uri !== "string") {
        throw new Error("Invalid uri: must be non-empty string");
      }

      // Use circuit breaker for resilience
      return await this.resourceCallBreaker.fire(serverId, uri);
    } catch (error) {
      this.logger.error("Failed to read resource", {
        serverId,
        uri,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getPresetPrompts(config: GatewayPresetConfig): Promise<any[]> {
    this.logger.debug("Getting preset prompts", { presetId: config.id });

    try {
      // Disabled presets return no prompts
      if (config.status !== "active") {
        this.logger.warn("Preset is not active", {
          presetId: config.id,
          status: config.status,
        });
        return [];
      }

      // TODO: Implement prompt listing through MCP manager
      // For now, return empty array as placeholder
      this.logger.info("Prompt listing not yet implemented");
      return [];
    } catch (error) {
      this.logger.error("Failed to get preset prompts", {
        presetId: config.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getPrompt(
    serverId: string,
    promptName: string,
    args: unknown,
  ): Promise<any> {
    this.logger.debug("Getting prompt", { serverId, promptName });

    try {
      // Validate inputs
      if (!serverId || typeof serverId !== "string") {
        throw new Error("Invalid serverId: must be non-empty string");
      }
      if (!promptName || typeof promptName !== "string") {
        throw new Error("Invalid promptName: must be non-empty string");
      }

      // args can be unknown but should at least be defined
      if (args === undefined) {
        args = {};
      }

      // Use circuit breaker for resilience
      return await this.promptCallBreaker.fire(serverId, promptName, args);
    } catch (error) {
      this.logger.error("Failed to get prompt", {
        serverId,
        promptName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async executeToolCall(
    serverId: string,
    toolName: string,
    args: unknown,
  ): Promise<unknown> {
    // Validate serverId and toolName are non-empty
    if (!serverId || typeof serverId !== "string") {
      throw new Error("Invalid serverId: must be non-empty string");
    }
    if (!toolName || typeof toolName !== "string") {
      throw new Error("Invalid toolName: must be non-empty string");
    }

    // args can be unknown but should at least be defined
    if (args === undefined) {
      args = {};
    }

    // FIX: Use circuit breaker with timeout (30 seconds)
    return this.toolCallBreaker.fire(serverId, toolName, args);
  }
}
