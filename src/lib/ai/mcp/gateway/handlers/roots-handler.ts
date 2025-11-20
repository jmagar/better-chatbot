import type { GatewayService } from "../gateway-service";
import type { GatewayPresetConfig } from "@/lib/domain/gateway/gateway-preset.entity";
import globalLogger from "@/lib/logger";

const logger = globalLogger.withTag("roots-handler");

/**
 * Create handler for roots/list MCP protocol method
 *
 * Returns list of file system roots from preset configuration
 */
export function createRootsListHandler(
  gatewayService: GatewayService,
  presetConfig: GatewayPresetConfig,
) {
  return async (): Promise<{ roots: any[] }> => {
    const startTime = Date.now();
    logger.debug("Handling roots/list request", { presetId: presetConfig.id });

    try {
      const roots = await gatewayService.getPresetRoots(presetConfig);

      const duration = Date.now() - startTime;
      logger.info("Roots listed successfully", {
        presetId: presetConfig.id,
        rootCount: roots.length,
        duration: `${duration}ms`,
      });

      return { roots };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Failed to list roots", {
        presetId: presetConfig.id,
        error: error instanceof Error ? error.message : String(error),
        duration: `${duration}ms`,
      });

      return {
        roots: [],
      };
    }
  };
}
