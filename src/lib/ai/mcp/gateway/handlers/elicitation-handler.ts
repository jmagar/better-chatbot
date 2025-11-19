/**
 * MCP Elicitation Handler
 *
 * Implements elicitation/create for human-in-the-loop workflows.
 * Enables servers to request dynamic input from users (approvals, clarifications,
 * credentials, etc.) with form or URL modes.
 */

import type { GatewayService } from "../gateway-service";
import type { Logger } from "@/lib/logger/console-logger";

// JSONSchema types
export interface JSONSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  description?: string;
}

// Elicitation Types
export interface ElicitationParams {
  mode: "form" | "url";
  message: string;
  requestedSchema?: JSONSchema;
  url?: string;
}

export interface ElicitationResponse {
  action: "accept" | "decline" | "cancel";
  content?: Record<string, unknown>;
}

/**
 * Creates handler for elicitation/create requests
 */
export function createElicitationCreateHandler(
  _gatewayService: GatewayService,
  logger: Logger,
) {
  return async (request: {
    params?: ElicitationParams;
  }): Promise<ElicitationResponse> => {
    const startTime = Date.now();

    try {
      const params = request.params;
      if (!params) {
        throw new Error("Missing params for elicitation/create");
      }

      if (!params.mode) {
        throw new Error("Mode is required (form or url)");
      }

      if (!params.message) {
        throw new Error("Message is required");
      }

      if (params.mode === "form" && !params.requestedSchema) {
        throw new Error("requestedSchema is required for form mode");
      }

      if (params.mode === "url" && !params.url) {
        throw new Error("url is required for url mode");
      }

      logger.debug("Processing elicitation/create request", {
        mode: params.mode,
        message: params.message,
        hasSchema: !!params.requestedSchema,
        url: params.url,
      });

      // In a real implementation, this would:
      // 1. Display form/URL to user with clear server identification
      // 2. For form mode: collect input with client-side validation
      // 3. For URL mode: open browser and wait for callback
      // 4. User can accept (with data), decline, or cancel
      // 5. Return user's decision to server
      //
      // For now, we return a mock response to demonstrate the interface
      const response: ElicitationResponse = {
        action: "accept",
        content:
          params.mode === "form"
            ? {
                mockField: "Mock elicitation response",
                note: "In production, this would contain user-provided data after validation",
              }
            : undefined,
      };

      const duration = Date.now() - startTime;
      logger.info("Elicitation request completed", {
        duration: `${duration}ms`,
        mode: params.mode,
        action: response.action,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("Elicitation request failed", {
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}
