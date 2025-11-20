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
      async (serverId: string, uri: string) => {
        const client = await this.mcpManager.getClient(serverId);
        if (!client) {
          throw new Error(`Client ${serverId} not found`);
        }
        return await client.client.readResource(uri);
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
      async (serverId: string, promptName: string, args: unknown) => {
        const client = await this.mcpManager.getClient(serverId);
        if (!client) {
          throw new Error(`Client ${serverId} not found`);
        }
        return await client.client.getPrompt(
          promptName,
          args as Record<string, unknown>,
        );
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
    const startTime = Date.now();
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

      const allResources: any[] = [];

      for (const serverConfig of config.servers) {
        // Skip disabled servers
        if (!serverConfig.enabled) continue;

        try {
          const client = await this.mcpManager.getClient(
            serverConfig.mcpServerId,
          );
          if (!client) {
            this.logger.warn("Client not found", {
              serverId: serverConfig.mcpServerId,
            });
            continue;
          }

          const resources = await withTimeout(
            client.client.listResources(),
            5000,
            "Timeout listing resources",
          );

          // Add server context to each resource
          for (const resource of resources) {
            allResources.push({
              ...resource,
              _mcpServerId: serverConfig.mcpServerId,
              _mcpServerName: client.client.getInfo().name,
            });
          }
        } catch (error) {
          this.logger.error("Failed to list resources from server", {
            serverId: serverConfig.mcpServerId,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with other servers
        }
      }

      const duration = Date.now() - startTime;
      this.logger.info("Loaded preset resources", {
        presetId: config.id,
        resourceCount: allResources.length,
        duration: `${duration}ms`,
      });

      return allResources;
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
    const startTime = Date.now();
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

      const allPrompts: any[] = [];

      for (const serverConfig of config.servers) {
        // Skip disabled servers
        if (!serverConfig.enabled) continue;

        try {
          const client = await this.mcpManager.getClient(
            serverConfig.mcpServerId,
          );
          if (!client) {
            this.logger.warn("Client not found", {
              serverId: serverConfig.mcpServerId,
            });
            continue;
          }

          const prompts = await withTimeout(
            client.client.listPrompts(),
            5000,
            "Timeout listing prompts",
          );

          // Add server context to each prompt
          for (const prompt of prompts) {
            allPrompts.push({
              ...prompt,
              _mcpServerId: serverConfig.mcpServerId,
              _mcpServerName: client.client.getInfo().name,
            });
          }
        } catch (error) {
          this.logger.error("Failed to list prompts from server", {
            serverId: serverConfig.mcpServerId,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with other servers
        }
      }

      const duration = Date.now() - startTime;
      this.logger.info("Loaded preset prompts", {
        presetId: config.id,
        promptCount: allPrompts.length,
        duration: `${duration}ms`,
      });

      return allPrompts;
    } catch (error) {
      this.logger.error("Failed to get preset prompts", {
        presetId: config.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get all roots from enabled servers in a preset
   */
  async getPresetRoots(config: GatewayPresetConfig): Promise<any[]> {
    const startTime = Date.now();
    this.logger.debug("Getting preset roots", { presetId: config.id });

    try {
      // Disabled presets return no roots
      if (config.status !== "active") {
        this.logger.warn("Preset is not active", {
          presetId: config.id,
          status: config.status,
        });
        return [];
      }

      const allRoots: any[] = [];

      for (const serverConfig of config.servers) {
        // Skip disabled servers
        if (!serverConfig.enabled) continue;

        try {
          const client = await this.mcpManager.getClient(
            serverConfig.mcpServerId,
          );
          if (!client) {
            this.logger.warn("Client not found", {
              serverId: serverConfig.mcpServerId,
            });
            continue;
          }

          const roots = await withTimeout(
            client.listRoots(),
            10000,
            "Timeout listing roots",
          );

          allRoots.push(...roots);
        } catch (error) {
          this.logger.error("Failed to get roots from server", {
            serverId: serverConfig.mcpServerId,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with other servers
        }
      }

      const duration = Date.now() - startTime;
      this.logger.info("Loaded preset roots", {
        presetId: config.id,
        rootCount: allRoots.length,
        duration: `${duration}ms`,
      });

      return allRoots;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error("Failed to get preset roots", {
        presetId: config.id,
        error: error instanceof Error ? error.message : String(error),
        duration: `${duration}ms`,
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
