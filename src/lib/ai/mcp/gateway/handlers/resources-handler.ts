import type { GatewayService } from "../gateway-service";
import type { GatewayPresetConfig } from "../types";
import globalLogger from "@/lib/logger";

const logger = globalLogger.withTag("ResourcesHandler");

/**
 * Creates a resources/list handler for MCP protocol
 */
export function createResourcesListHandler(
  gatewayService: GatewayService,
  presetConfig: GatewayPresetConfig | null,
) {
  return async () => {
    logger.debug("Handling resources/list request", {
      presetId: presetConfig?.id,
    });

    try {
      if (!presetConfig) {
        logger.warn("No preset config for resource listing");
        return { resources: [] };
      }

      const resources = await gatewayService.getPresetResources(presetConfig);

      logger.info("Successfully listed resources", {
        resourceCount: resources.length,
        presetId: presetConfig.id,
      });

      return { resources };
    } catch (error) {
      logger.error("Failed to list resources", {
        presetId: presetConfig?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

/**
 * Creates a resources/read handler for MCP protocol
 */
export function createResourcesReadHandler(gatewayService: GatewayService) {
  return async (request: any) => {
    const uri = request.params?.uri;

    logger.debug("Handling resources/read request", { uri });

    // Validate URI
    if (!uri) {
      logger.warn("Resource read missing URI");
      return {
        contents: [],
        isError: true,
      };
    }

    try {
      // Extract server ID from URI or use first available server
      // This is a simplified implementation - should be enhanced based on URI scheme
      const serverId = extractServerIdFromUri(uri);

      if (!serverId) {
        logger.warn("Could not determine server ID from URI", { uri });
        throw new Error("Invalid resource URI");
      }

      const result = await gatewayService.readResource(serverId, uri);

      logger.info("Resource read successfully", {
        uri,
        serverId,
      });

      return result;
    } catch (error: any) {
      logger.error("Failed to read resource", {
        uri,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        contents: [
          {
            uri,
            mimeType: "text/plain",
            text: `Error reading resource: ${error.message || "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  };
}

/**
 * Extract server ID from resource URI
 * This is a placeholder implementation - should be enhanced based on actual URI schemes
 */
function extractServerIdFromUri(uri: string): string | null {
  try {
    // Example: file:/// scheme might map to filesystem server
    // Example: github:// scheme might map to github server
    const url = new URL(uri);

    switch (url.protocol) {
      case "file:":
        return "filesystem-server";
      case "github:":
        return "github-server";
      default:
        logger.warn("Unknown URI protocol", { protocol: url.protocol });
        return null;
    }
  } catch (e) {
    logger.warn("Failed to parse URI", { uri, error: String(e) });
    return null;
  }
}

/**
 * Creates a resources/templates/list handler for MCP protocol
 */
export function createResourceTemplatesListHandler(
  _gatewayService: GatewayService,
  presetConfig: GatewayPresetConfig | null,
) {
  return async () => {
    logger.debug("Handling resources/templates/list request", {
      presetId: presetConfig?.id,
    });

    try {
      // Resource templates allow dynamic URI patterns
      // For now, return empty array as placeholder
      logger.info("Resource templates listing (placeholder)");

      return { resourceTemplates: [] };
    } catch (error) {
      logger.error("Failed to list resource templates", {
        presetId: presetConfig?.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}
