import type { VercelAIMcpTool } from "@/types/mcp";
import type { GatewayService } from "../gateway-service";
import globalLogger from "@/lib/logger";

const logger = globalLogger.withTag("ToolsHandler");

/**
 * Converts a VercelAI MCP Tool to MCP protocol tool format
 */
export function convertToMCPTool(toolId: string, tool: VercelAIMcpTool) {
  const inputSchema: any = {
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
      logger.warn(`Failed to extract schema for tool ${toolId}:`, e);
    }
  }

  return {
    name: toolId,
    description: tool.description || `Tool from ${tool._mcpServerName}`,
    inputSchema,
  };
}

/**
 * Creates a tools/list handler for MCP protocol
 */
export function createToolsListHandler(tools: Record<string, VercelAIMcpTool>) {
  return async () => {
    logger.debug("Handling tools/list request", {
      toolCount: Object.keys(tools).length,
    });

    try {
      const toolsList = Object.entries(tools).map(([id, t]) =>
        convertToMCPTool(id, t),
      );

      logger.info("Successfully listed tools", {
        toolCount: toolsList.length,
      });

      return { tools: toolsList };
    } catch (error) {
      logger.error("Failed to list tools", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

/**
 * Creates a tools/call handler for MCP protocol
 */
export function createToolsCallHandler(
  tools: Record<string, VercelAIMcpTool>,
  gatewayService: GatewayService,
  transformResult: (result: any) => any,
) {
  return async (request: any) => {
    const toolName = request.params?.name;
    const args = request.params?.arguments || {};

    logger.debug("Handling tools/call request", {
      toolName,
      hasArgs: Object.keys(args).length > 0,
    });

    // Validate tool name
    if (!toolName) {
      logger.warn("Tool call missing tool name");
      return {
        content: [{ type: "text", text: "Error: Tool name is required" }],
        isError: true,
      };
    }

    // Find the tool
    const targetTool = tools[toolName];
    if (!targetTool) {
      logger.warn("Tool not found", { toolName });
      return {
        content: [{ type: "text", text: `Error: Tool not found: ${toolName}` }],
        isError: true,
      };
    }

    try {
      // Execute tool through gateway service (with circuit breaker)
      const result = await gatewayService.executeToolCall(
        targetTool._mcpServerId,
        targetTool._originToolName,
        args,
      );

      logger.info("Tool executed successfully", {
        toolName,
        serverId: targetTool._mcpServerId,
      });

      // Transform result to MCP format
      return transformResult(result);
    } catch (error: any) {
      logger.error("Tool execution failed", {
        toolName,
        serverId: targetTool._mcpServerId,
        error: error instanceof Error ? error.message : String(error),
      });

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
  };
}
