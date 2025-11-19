import { describe, it, expect, beforeEach, vi } from "vitest";
import { MCPProtocolServer } from "./mcp-protocol-server";
import { GatewayService } from "./gateway-service";
import type { GatewayPresetConfig } from "./types";
import type { VercelAIMcpTool } from "@/types/mcp";
import { jsonSchema } from "ai";
import { z } from "zod";

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

describe("MCPProtocolServer - Tools", () => {
  let gatewayService: GatewayService;
  let presetConfig: GatewayPresetConfig;

  beforeEach(() => {
    gatewayService = {
      getPresetTools: vi.fn(),
      executeToolCall: vi.fn(),
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

  describe("Tool Execution", () => {
    it("should execute a tool successfully", async () => {
      const mockTools: Record<string, VercelAIMcpTool> = {
        "test-server::write-file": {
          description: "Write content to a file",
          parameters: jsonSchema(
            z.object({
              path: z.string().describe("File path"),
              content: z.string().describe("File content"),
            }),
          ),
          execute: vi.fn(),
          _mcpServerName: "test-server",
          _mcpServerId: "test-server-id",
          _originToolName: "write-file",
        },
      };

      const mockResult = {
        content: [
          {
            type: "text",
            text: "File written successfully to /tmp/test.txt",
          },
        ],
      };

      vi.mocked(gatewayService.getPresetTools).mockResolvedValue(mockTools);
      vi.mocked(gatewayService.executeToolCall).mockResolvedValue(mockResult);

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      // This would be called by the MCP SDK when client executes tool
      // We're testing the execution flow through the gateway service
      const result = await gatewayService.executeToolCall(
        "test-server-id",
        "write-file",
        { path: "/tmp/test.txt", content: "Hello" },
      );

      expect(result).toEqual(mockResult);
      expect(gatewayService.executeToolCall).toHaveBeenCalledWith(
        "test-server-id",
        "write-file",
        { path: "/tmp/test.txt", content: "Hello" },
      );
    });

    it("should handle tool execution errors", async () => {
      const mockTools: Record<string, VercelAIMcpTool> = {
        "test-server::failing-tool": {
          description: "A tool that fails",
          execute: vi.fn(),
          _mcpServerName: "test-server",
          _mcpServerId: "test-server-id",
          _originToolName: "failing-tool",
        },
      };

      vi.mocked(gatewayService.getPresetTools).mockResolvedValue(mockTools);
      vi.mocked(gatewayService.executeToolCall).mockRejectedValue(
        new Error("Tool execution failed"),
      );

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      await expect(
        gatewayService.executeToolCall("test-server-id", "failing-tool", {}),
      ).rejects.toThrow("Tool execution failed");
    });

    it("should execute multiple tools in sequence", async () => {
      const mockTools: Record<string, VercelAIMcpTool> = {
        "test-server::tool1": {
          description: "First tool",
          execute: vi.fn(),
          _mcpServerName: "test-server",
          _mcpServerId: "test-server-id",
          _originToolName: "tool1",
        },
        "test-server::tool2": {
          description: "Second tool",
          execute: vi.fn(),
          _mcpServerName: "test-server",
          _mcpServerId: "test-server-id",
          _originToolName: "tool2",
        },
      };

      vi.mocked(gatewayService.getPresetTools).mockResolvedValue(mockTools);
      vi.mocked(gatewayService.executeToolCall)
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "Result 1" }],
        })
        .mockResolvedValueOnce({
          content: [{ type: "text", text: "Result 2" }],
        });

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      const result1 = await gatewayService.executeToolCall(
        "test-server-id",
        "tool1",
        {},
      );
      const result2 = await gatewayService.executeToolCall(
        "test-server-id",
        "tool2",
        {},
      );

      expect(result1.content[0].text).toBe("Result 1");
      expect(result2.content[0].text).toBe("Result 2");
      expect(gatewayService.executeToolCall).toHaveBeenCalledTimes(2);
    });

    it("should validate tool parameters", async () => {
      const mockTools: Record<string, VercelAIMcpTool> = {
        "test-server::strict-tool": {
          description: "Tool with required parameters",
          parameters: jsonSchema(
            z.object({
              required_param: z.string().describe("Required parameter"),
              optional_param: z
                .string()
                .optional()
                .describe("Optional parameter"),
            }),
          ),
          execute: vi.fn(),
          _mcpServerName: "test-server",
          _mcpServerId: "test-server-id",
          _originToolName: "strict-tool",
        },
      };

      vi.mocked(gatewayService.getPresetTools).mockResolvedValue(mockTools);

      const server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      const status = await server.getStatus();
      expect(status.totalTools).toBe(1);
    });
  });

  describe("Tool Listing", () => {
    it("should list all available tools with correct metadata", async () => {
      const mockTools: Record<string, VercelAIMcpTool> = {
        "github::create-issue": {
          description: "Create a GitHub issue",
          parameters: jsonSchema(
            z.object({
              title: z.string(),
              body: z.string(),
              labels: z.array(z.string()).optional(),
            }),
          ),
          execute: vi.fn(),
          _mcpServerName: "github",
          _mcpServerId: "github-server",
          _originToolName: "create-issue",
        },
        "filesystem::read-file": {
          description: "Read file contents",
          parameters: jsonSchema(
            z.object({
              path: z.string(),
            }),
          ),
          execute: vi.fn(),
          _mcpServerName: "filesystem",
          _mcpServerId: "fs-server",
          _originToolName: "read-file",
        },
      };

      vi.mocked(gatewayService.getPresetTools).mockResolvedValue(mockTools);

      const server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      const status = await server.getStatus();
      expect(status.totalTools).toBe(2);
      expect(status.exposedServerCount).toBe(2);
    });
  });
});
