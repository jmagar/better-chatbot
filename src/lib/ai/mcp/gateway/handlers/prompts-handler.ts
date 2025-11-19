import type { GatewayService } from "../gateway-service";
import type { GatewayPresetConfig } from "../types";
import globalLogger from "@/lib/logger";

const logger = globalLogger.withTag("PromptsHandler");

/**
 * Creates a prompts/list handler for MCP protocol
 */
export function createPromptsListHandler(
  gatewayService: GatewayService,
  presetConfig: GatewayPresetConfig | null,
) {
  return async () => {
    logger.debug("Handling prompts/list request", {
      presetId: presetConfig?.id,
    });

    try {
      if (!presetConfig) {
        logger.warn("No preset config for prompt listing");
        return { prompts: [] };
      }

      const prompts = await gatewayService.getPresetPrompts(presetConfig);

      logger.info("Successfully listed prompts", {
        promptCount: prompts.length,
        presetId: presetConfig.id,
      });

      return { prompts };
    } catch (error) {
      logger.error("Failed to list prompts", {
        presetId: presetConfig?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

/**
 * Creates a prompts/get handler for MCP protocol
 */
export function createPromptsGetHandler(gatewayService: GatewayService) {
  return async (request: { params?: { name?: string; arguments?: Record<string, unknown> } }) => {
    const promptName = request.params?.name;
    const args = request.params?.arguments || {};

    logger.debug("Handling prompts/get request", {
      promptName,
      hasArgs: Object.keys(args).length > 0,
    });

    // Validate prompt name
    if (!promptName) {
      logger.warn("Prompt get missing prompt name");
      return {
        messages: [],
        isError: true,
      };
    }

    try {
      // Extract server ID from prompt name or use first available server
      // This is a simplified implementation - should be enhanced
      const serverId = extractServerIdFromPromptName(promptName);

      if (!serverId) {
        logger.warn("Could not determine server ID from prompt name", {
          promptName,
        });
        throw new Error("Invalid prompt name");
      }

      const result = await gatewayService.getPrompt(serverId, promptName, args);

      logger.info("Prompt retrieved successfully", {
        promptName,
        serverId,
      });

      return result;
    } catch (error) {
      logger.error("Failed to get prompt", {
        promptName,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        description: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Error retrieving prompt: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          },
        ],
        isError: true,
      };
    }
  };
}

/**
 * Extract server ID from prompt name
 * This is a placeholder implementation - should be enhanced based on naming conventions
 */
function extractServerIdFromPromptName(promptName: string): string | null {
  try {
    // Example: "github::code-review" -> "github"
    if (promptName.includes("::")) {
      const [serverId] = promptName.split("::");
      return serverId;
    }

    // Fallback: return null and let caller handle
    logger.warn("Could not extract server ID from prompt name", {
      promptName,
    });
    return null;
  } catch (e) {
    logger.warn("Failed to parse prompt name", {
      promptName,
      error: String(e),
    });
    return null;
  }
}
