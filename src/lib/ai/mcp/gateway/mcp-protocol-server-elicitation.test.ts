import { describe, it, expect, beforeEach, vi } from "vitest";
import { createElicitationCreateHandler } from "./handlers/elicitation-handler";
import type { GatewayService } from "./gateway-service";
import globalLogger from "@/lib/logger";

describe("MCP Protocol Server - Elicitation", () => {
  let mockGatewayService: Pick<
    GatewayService,
    | "getPresetTools"
    | "executeToolCall"
    | "getPresetResources"
    | "readResource"
    | "getPresetPrompts"
    | "getPrompt"
  >;
  let logger: ReturnType<typeof globalLogger.withTag>;

  beforeEach(() => {
    mockGatewayService = {
      getPresetTools: vi.fn().mockResolvedValue({}),
      executeToolCall: vi.fn(),
      getPresetResources: vi.fn().mockResolvedValue([]),
      readResource: vi.fn(),
      getPresetPrompts: vi.fn().mockResolvedValue([]),
      getPrompt: vi.fn(),
    };
    logger = globalLogger.withTag("test");
  });

  describe("elicitation/create", () => {
    it("should handle form mode with schema", async () => {
      const handler = createElicitationCreateHandler(
        mockGatewayService as GatewayService,
        logger,
      );

      const result = await handler({
        params: {
          mode: "form",
          message: "Please provide deployment credentials",
          requestedSchema: {
            type: "object",
            properties: {
              apiKey: {
                type: "string",
                description: "API Key",
              },
              region: {
                type: "string",
                enum: ["us-east-1", "eu-west-1"],
                description: "Deployment region",
              },
            },
            required: ["apiKey", "region"],
          },
        },
      });

      expect(result.action).toBe("accept");
      expect(result.content).toBeDefined();
    });

    it("should handle URL mode", async () => {
      const handler = createElicitationCreateHandler(
        mockGatewayService as GatewayService,
        logger,
      );

      const result = await handler({
        params: {
          mode: "url",
          message: "Please authorize application access",
          url: "https://example.com/oauth/authorize?client_id=123",
        },
      });

      expect(result.action).toBe("accept");
    });

    it("should handle accept action with content", async () => {
      const handler = createElicitationCreateHandler(
        mockGatewayService as GatewayService,
        logger,
      );

      const result = await handler({
        params: {
          mode: "form",
          message: "Provide info",
          requestedSchema: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
          },
        },
      });

      expect(result.action).toBe("accept");
      expect(result.content).toBeDefined();
    });

    it("should throw error for missing params", async () => {
      const handler = createElicitationCreateHandler(
        mockGatewayService as GatewayService,
        logger,
      );

      await expect(handler({})).rejects.toThrow(
        "Missing params for elicitation/create",
      );
    });

    it("should throw error for missing mode", async () => {
      const handler = createElicitationCreateHandler(
        mockGatewayService as GatewayService,
        logger,
      );

      // @ts-expect-error - Testing invalid input
      await expect(
        handler({
          params: {
            message: "Test",
          },
        }),
      ).rejects.toThrow("Mode is required");
    });

    it("should throw error for form mode without schema", async () => {
      const handler = createElicitationCreateHandler(
        mockGatewayService as GatewayService,
        logger,
      );

      await expect(
        handler({
          params: {
            mode: "form",
            message: "Test",
          },
        }),
      ).rejects.toThrow("requestedSchema is required for form mode");
    });

    it("should throw error for URL mode without url", async () => {
      const handler = createElicitationCreateHandler(
        mockGatewayService as GatewayService,
        logger,
      );

      await expect(
        handler({
          params: {
            mode: "url",
            message: "Test",
          },
        }),
      ).rejects.toThrow("url is required for url mode");
    });
  });
});
