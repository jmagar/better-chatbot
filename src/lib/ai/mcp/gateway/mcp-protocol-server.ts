import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { VercelAIMcpTool } from "@/types/mcp";
import { GatewayService } from "./gateway-service";
import type { GatewayPresetConfig } from "./types";
import globalLogger from "@/lib/logger";

/**
 * Converts a VercelAI MCP Tool to MCP protocol tool format
 */
function convertToMCPTool(toolId: string, tool: VercelAIMcpTool) {
  // Extract input schema from Zod schema
  let inputSchema: any = {
    type: "object",
    properties: {},
    required: [],
  };

  if (tool.parameters) {
    try {
      // Try to extract schema from Zod
      const zodDef = (tool.parameters as any)?._def;
      if (zodDef?.shape) {
        const shape = zodDef.shape();
        inputSchema.properties = Object.keys(shape).reduce(
          (acc, key) => {
            const field = shape[key];
            acc[key] = {
              type: field._def?.typeName?.toLowerCase() || "string",
              description: field._def?.description || "",
            };
            return acc;
          },
          {} as Record<string, any>,
        );
        inputSchema.required = Object.keys(shape).filter(
          (key) => !shape[key].isOptional(),
        );
      }
    } catch (e) {
      // Fallback to empty schema
      globalLogger.warn(`Failed to extract schema for tool ${toolId}:`, e);
    }
  }

  return {
    name: toolId,
    description: tool.description || `Tool from ${tool._mcpServerName}`,
    inputSchema,
  };
}

/**
 * MCP Protocol Server for a specific preset or all tools
 * Wraps the GatewayService and exposes tools via MCP protocol
 */
export class MCPProtocolServer {
  private server: Server;
  private logger = globalLogger.withTag("MCP-Protocol");

  constructor(
    private gatewayService: GatewayService,
    private presetConfig: GatewayPresetConfig | null, // null = all tools
    private serverName: string,
  ) {
    this.server = new Server(
      {
        name: serverName,
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.logger.info(`Initializing MCP server: ${serverName}`);
  }

  /**
   * Initialize the server by registering all tools
   */
  async initialize(): Promise<void> {
    try {
      const tools = this.presetConfig
        ? await this.gatewayService.getPresetTools(this.presetConfig)
        : {}; // TODO: Implement get all tools

      this.logger.info(`Registering ${Object.keys(tools).length} tools`);

      // Register each tool with the MCP server
      for (const [toolId, tool] of Object.entries(tools)) {
        const mcpTool = convertToMCPTool(toolId, tool);

        this.server.setRequestHandler(
          {
            method: "tools/list",
          } as any,
          async () => {
            return {
              tools: Object.entries(tools).map(([id, t]) =>
                convertToMCPTool(id, t),
              ),
            };
          },
        );

        this.server.setRequestHandler(
          {
            method: "tools/call",
          } as any,
          async (request: any) => {
            const toolName = request.params?.name;
            const args = request.params?.arguments || {};

            if (!toolName) {
              return {
                content: [
                  { type: "text", text: "Error: Tool name is required" },
                ],
                isError: true,
              };
            }

            const targetTool = tools[toolName];
            if (!targetTool) {
              return {
                content: [
                  { type: "text", text: `Error: Tool not found: ${toolName}` },
                ],
                isError: true,
              };
            }

            try {
              const result = await this.gatewayService.executeToolCall(
                targetTool._mcpServerId,
                targetTool._originToolName,
                args,
              );

              // Transform result to MCP format
              return this.transformResult(result);
            } catch (error: any) {
              this.logger.error(`Tool call failed: ${toolName}`, error);
              return {
                content: [
                  {
                    type: "text",
                    text: `Error: ${error.message || "Unknown error"}`,
                  },
                ],
                isError: true,
              };
            }
          },
        );
      }

      this.logger.info(`MCP server initialized with ${Object.keys(tools).length} tools`);
    } catch (error) {
      this.logger.error("Failed to initialize MCP server", error);
      throw error;
    }
  }

  /**
   * Transform tool execution result to MCP protocol format
   */
  private transformResult(result: any): any {
    if (!result) {
      return {
        content: [{ type: "text", text: "Success" }],
      };
    }

    // If result already has MCP format
    if (result.content && Array.isArray(result.content)) {
      return result;
    }

    // If result is a string
    if (typeof result === "string") {
      return {
        content: [{ type: "text", text: result }],
      };
    }

    // If result is an object
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  /**
   * Get the underlying MCP Server instance
   */
  getServer(): Server {
    return this.server;
  }
}
