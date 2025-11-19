import globalLogger from "@/lib/logger";

const logger = globalLogger.withTag("ResultTransformer");

/**
 * Transform result to MCP protocol format
 * Handles various result formats and normalizes them to MCP content format
 */
export function transformResult(result: any): any {
  try {
    // If result already has MCP format
    if (result?.content && Array.isArray(result.content)) {
      logger.debug("Result already in MCP format");
      return result;
    }

    // If result is a string
    if (typeof result === "string") {
      logger.debug("Transforming string result to MCP format");
      return {
        content: [{ type: "text", text: result }],
      };
    }

    // If result is an object
    logger.debug("Transforming object result to MCP format");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    logger.error("Failed to transform result", {
      error: error instanceof Error ? error.message : String(error),
    });

    // Return error in MCP format
    return {
      content: [
        {
          type: "text",
          text: `Error transforming result: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Create an error response in MCP format
 */
export function createErrorResponse(
  message: string,
  details?: Record<string, any>,
): any {
  logger.warn("Creating error response", { message, details });

  return {
    content: [
      {
        type: "text",
        text: message,
      },
    ],
    isError: true,
    ...(details && { details }),
  };
}

/**
 * Validate MCP request parameters
 */
export function validateRequestParams(
  params: any,
  required: string[],
): { valid: boolean; error?: string } {
  if (!params || typeof params !== "object") {
    return { valid: false, error: "Invalid request parameters" };
  }

  for (const field of required) {
    if (!(field in params)) {
      return {
        valid: false,
        error: `Missing required parameter: ${field}`,
      };
    }
  }

  return { valid: true };
}
