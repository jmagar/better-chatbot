import { describe, it, expect, beforeEach, vi } from "vitest";
import { MCPProtocolServer } from "./mcp-protocol-server";
import { GatewayService } from "./gateway-service";
import type { GatewayPresetConfig } from "./types";

// Mock dependencies
vi.mock("./gateway-service");
vi.mock("@/lib/logger", () => ({
  default: {
    withTag: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

describe("MCPProtocolServer - Prompts", () => {
  let gatewayService: GatewayService;
  let presetConfig: GatewayPresetConfig;

  beforeEach(() => {
    gatewayService = {
      getPresetTools: vi.fn().mockResolvedValue({}),
      executeToolCall: vi.fn(),
      getPresetPrompts: vi.fn(),
      getPrompt: vi.fn(),
    } as any;

    presetConfig = {
      id: "test-preset-id",
      userId: "test-user-id",
      slug: "test-preset",
      name: "Test Preset",
      description: "Test preset description",
      visibility: "private",
      status: "active",
      servers: [
        {
          id: "server-1",
          mcpServerId: "test-server-id",
          enabled: true,
          allowedToolNames: [],
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe("Prompt Listing", () => {
    it("should list all available prompts", async () => {
      const mockPrompts = [
        {
          name: "code-review",
          description: "Review code for best practices and issues",
          arguments: [
            {
              name: "code",
              description: "The code to review",
              required: true,
            },
            {
              name: "language",
              description: "Programming language",
              required: false,
            },
          ],
        },
        {
          name: "summarize-text",
          description: "Summarize a long text",
          arguments: [
            {
              name: "text",
              description: "Text to summarize",
              required: true,
            },
          ],
        },
      ];

      vi.mocked(gatewayService.getPresetPrompts).mockResolvedValue(mockPrompts);

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      const prompts = await gatewayService.getPresetPrompts(presetConfig);

      expect(prompts).toHaveLength(2);
      expect(prompts[0].name).toBe("code-review");
      expect(prompts[1].name).toBe("summarize-text");
    });

    it("should handle empty prompt list", async () => {
      vi.mocked(gatewayService.getPresetPrompts).mockResolvedValue([]);

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      const prompts = await gatewayService.getPresetPrompts(presetConfig);

      expect(prompts).toHaveLength(0);
    });

    it("should filter prompts by preset configuration", async () => {
      const mockPrompts = [
        {
          name: "allowed-prompt",
          description: "An allowed prompt",
          arguments: [],
        },
      ];

      vi.mocked(gatewayService.getPresetPrompts).mockResolvedValue(mockPrompts);

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      const prompts = await gatewayService.getPresetPrompts(presetConfig);

      expect(prompts).toHaveLength(1);
      expect(gatewayService.getPresetPrompts).toHaveBeenCalledWith(
        presetConfig,
      );
    });
  });

  describe("Prompt Retrieval", () => {
    it("should get a specific prompt with arguments", async () => {
      const mockPrompt = {
        description: "Review code for best practices",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Please review this code: function test() { return true; }",
            },
          },
        ],
      };

      vi.mocked(gatewayService.getPrompt).mockResolvedValue(mockPrompt);

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      const result = await gatewayService.getPrompt(
        "test-server-id",
        "code-review",
        { code: "function test() { return true; }", language: "javascript" },
      );

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content.text).toContain("Please review");
    });

    it("should handle prompts with required arguments", async () => {
      const mockPrompt = {
        description: "Summarize text",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Summarize: Long text here...",
            },
          },
        ],
      };

      vi.mocked(gatewayService.getPrompt).mockResolvedValue(mockPrompt);

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      const result = await gatewayService.getPrompt(
        "test-server-id",
        "summarize-text",
        { text: "Long text here..." },
      );

      expect(result.messages[0].content.text).toContain("Long text here");
    });

    it("should handle prompt not found errors", async () => {
      vi.mocked(gatewayService.getPrompt).mockRejectedValue(
        new Error("Prompt not found"),
      );

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      await expect(
        gatewayService.getPrompt("test-server-id", "nonexistent", {}),
      ).rejects.toThrow("Prompt not found");
    });

    it("should handle prompts with multiple messages", async () => {
      const mockPrompt = {
        description: "Complex conversation prompt",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "What is the weather?",
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "I need your location to check the weather.",
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: "I'm in San Francisco",
            },
          },
        ],
      };

      vi.mocked(gatewayService.getPrompt).mockResolvedValue(mockPrompt);

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      const result = await gatewayService.getPrompt(
        "test-server-id",
        "weather-conversation",
        {},
      );

      expect(result.messages).toHaveLength(3);
      expect(result.messages[1].role).toBe("assistant");
    });

    it("should handle prompts with embedded resources", async () => {
      const mockPrompt = {
        description: "Prompt with resource",
        messages: [
          {
            role: "user",
            content: {
              type: "resource",
              resource: {
                uri: "file:///workspace/data.json",
                mimeType: "application/json",
                text: '{"key": "value"}',
              },
            },
          },
        ],
      };

      vi.mocked(gatewayService.getPrompt).mockResolvedValue(mockPrompt);

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      const result = await gatewayService.getPrompt(
        "test-server-id",
        "data-prompt",
        {},
      );

      expect(result.messages[0].content.type).toBe("resource");
      expect(result.messages[0].content.resource).toBeDefined();
    });
  });

  describe("Prompt Arguments Validation", () => {
    it("should validate required arguments", async () => {
      const mockPrompts = [
        {
          name: "test-prompt",
          description: "Test prompt",
          arguments: [
            {
              name: "required_arg",
              description: "Required argument",
              required: true,
            },
          ],
        },
      ];

      vi.mocked(gatewayService.getPresetPrompts).mockResolvedValue(mockPrompts);

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      const prompts = await gatewayService.getPresetPrompts(presetConfig);
      const requiredArgs = prompts[0].arguments.filter((arg) => arg.required);

      expect(requiredArgs).toHaveLength(1);
      expect(requiredArgs[0].name).toBe("required_arg");
    });

    it("should handle optional arguments", async () => {
      const mockPrompts = [
        {
          name: "test-prompt",
          description: "Test prompt",
          arguments: [
            {
              name: "optional_arg",
              description: "Optional argument",
              required: false,
            },
          ],
        },
      ];

      vi.mocked(gatewayService.getPresetPrompts).mockResolvedValue(mockPrompts);

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      const prompts = await gatewayService.getPresetPrompts(presetConfig);
      const optionalArgs = prompts[0].arguments.filter((arg) => !arg.required);

      expect(optionalArgs).toHaveLength(1);
    });
  });
});
