import type { VercelAIMcpTool } from "@/types/mcp";
import type { GatewayService } from "../gateway-service";
import globalLogger from "@/lib/logger";

const logger = globalLogger.withTag("ToolsHandler");

interface JSONSchemaProperty {
  type: string;
  description: string;
}

interface JSONSchema {
  type: string;
  properties: Record<string, JSONSchemaProperty>;
  required: string[];
}

/**
 * Converts a VercelAI MCP Tool to MCP protocol tool format
 */
export function convertToMCPTool(toolId: string, tool: VercelAIMcpTool) {
  const inputSchema: JSONSchema = {
    type: "object",
    properties: {},
    required: [],
  };

  if (tool.parameters) {
    try {
      // Try to extract schema from Zod
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          {} as Record<string, JSONSchemaProperty>,
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
) {
  return async (request: { params?: { name?: string; arguments?: Record<string, unknown> } }) => {
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
      return transformToolResult(result);
    } catch (error) {
      logger.error("Tool execution failed", {
        toolName,
        serverId: targetTool._mcpServerId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  };
}

/**
 * Transform tool execution result to MCP protocol format
 */
function transformToolResult(result: unknown): {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
} {
  if (!result) {
    return {
      content: [{ type: "text", text: "Success" }],
    };
  }

  // If result already has MCP format
  if (
    typeof result === "object" &&
    result !== null &&
    "content" in result &&
    Array.isArray(result.content)
  ) {
    return result as { content: Array<{ type: string; text: string }> };
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
