import { describe, it, expect, beforeEach, vi } from "vitest";
import { createSamplingCreateMessageHandler } from "./handlers/sampling-handler";
import type { GatewayService } from "./gateway-service";
import globalLogger from "@/lib/logger";

describe("MCP Protocol Server - Sampling", () => {
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

  describe("sampling/createMessage", () => {
    it("should handle simple text message", async () => {
      const handler = createSamplingCreateMessageHandler(
        mockGatewayService as GatewayService,
        logger,
      );

      const result = await handler({
        params: {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: "What is the capital of France?",
              },
            },
          ],
        },
      });

      expect(result).toMatchObject({
        role: "assistant",
        content: {
          type: "text",
          text: expect.any(String),
        },
        model: expect.any(String),
      });
    });

    it("should handle multiple messages (conversation)", async () => {
      const handler = createSamplingCreateMessageHandler(
        mockGatewayService as GatewayService,
        logger,
      );

      const result = await handler({
        params: {
          messages: [
            {
              role: "user",
              content: { type: "text", text: "Hello" },
            },
            {
              role: "assistant",
              content: { type: "text", text: "Hi there!" },
            },
            {
              role: "user",
              content: { type: "text", text: "How are you?" },
            },
          ],
        },
      });

      expect(result.role).toBe("assistant");
      expect(result.content.type).toBe("text");
    });

    it("should handle model preferences", async () => {
      const handler = createSamplingCreateMessageHandler(
        mockGatewayService as GatewayService,
        logger,
      );

      const result = await handler({
        params: {
          messages: [
            {
              role: "user",
              content: { type: "text", text: "Test" },
            },
          ],
          modelPreferences: {
            hints: [{ name: "claude-3-sonnet-20240229" }],
            intelligencePriority: 0.8,
          },
        },
      });

      expect(result.model).toBe("claude-3-sonnet-20240229");
    });

    it("should handle temperature and maxTokens", async () => {
      const handler = createSamplingCreateMessageHandler(
        mockGatewayService as GatewayService,
        logger,
      );

      const result = await handler({
        params: {
          messages: [
            {
              role: "user",
              content: { type: "text", text: "Test" },
            },
          ],
          temperature: 0.7,
          maxTokens: 1000,
          stopSequences: ["END"],
        },
      });

      expect(result).toBeDefined();
      expect(result.stopReason).toBeDefined();
    });

    it("should handle includeContext options", async () => {
      const handler = createSamplingCreateMessageHandler(
        mockGatewayService as GatewayService,
        logger,
      );

      for (const context of ["none", "thisServer", "allServers"] as const) {
        const result = await handler({
          params: {
            messages: [
              {
                role: "user",
                content: { type: "text", text: "Test" },
              },
            ],
            includeContext: context,
          },
        });

        expect(result).toBeDefined();
      }
    });

    it("should handle image content", async () => {
      const handler = createSamplingCreateMessageHandler(
        mockGatewayService as GatewayService,
        logger,
      );

      const result = await handler({
        params: {
          messages: [
            {
              role: "user",
              content: {
                type: "image",
                data: "base64encodedimage",
                mimeType: "image/png",
              },
            },
          ],
        },
      });

      expect(result).toBeDefined();
    });

    it("should handle embedded resource", async () => {
      const handler = createSamplingCreateMessageHandler(
        mockGatewayService as GatewayService,
        logger,
      );

      const result = await handler({
        params: {
          messages: [
            {
              role: "user",
              content: {
                type: "resource",
                uri: "file:///path/to/resource",
              },
            },
          ],
        },
      });

      expect(result).toBeDefined();
    });

    it("should throw error for missing params", async () => {
      const handler = createSamplingCreateMessageHandler(
        mockGatewayService as GatewayService,
        logger,
      );

      await expect(handler({})).rejects.toThrow(
        "Missing params for sampling/createMessage",
      );
    });

    it("should throw error for empty messages", async () => {
      const handler = createSamplingCreateMessageHandler(
        mockGatewayService as GatewayService,
        logger,
      );

      await expect(
        handler({
          params: {
            messages: [],
          },
        }),
      ).rejects.toThrow("At least one message is required");
    });
  });
});
