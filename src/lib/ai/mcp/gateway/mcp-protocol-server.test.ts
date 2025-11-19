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

describe("MCPProtocolServer", () => {
  let gatewayService: GatewayService;
  let presetConfig: GatewayPresetConfig;

  beforeEach(() => {
    // Create a mock gateway service
    gatewayService = {
      getPresetTools: vi.fn(),
      executeToolCall: vi.fn(),
      getPresetResources: vi.fn().mockResolvedValue([]),
      getPresetPrompts: vi.fn().mockResolvedValue([]),
    } as any;

    // Create a sample preset config
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

  describe("initialization", () => {
    it("should create an MCP protocol server instance", () => {
      const server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      expect(server).toBeDefined();
      expect(server.getServer()).toBeDefined();
    });

    it("should initialize with null preset config for all tools", () => {
      const server = new MCPProtocolServer(
        gatewayService,
        null,
        "test-all-tools",
      );

      expect(server).toBeDefined();
      expect(server.getServer()).toBeDefined();
    });
  });

  describe("getPresetTools integration", () => {
    it("should fetch tools from gateway service", async () => {
      const mockTools: Record<string, VercelAIMcpTool> = {
        "test-server::test-tool": {
          description: "Test tool description",
          parameters: jsonSchema(
            z.object({
              param1: z.string().describe("First parameter"),
              param2: z.number().optional().describe("Second parameter"),
            }),
          ),
          execute: vi.fn(),
          _mcpServerName: "test-server",
          _mcpServerId: "test-server-id",
          _originToolName: "test-tool",
        },
      };

      vi.mocked(gatewayService.getPresetTools).mockResolvedValue(mockTools);

      const server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      // Verify server instance is created
      expect(server.getServer()).toBeDefined();
    });
  });

  describe("getStatus", () => {
    it("should return status information without initialization", async () => {
      const mockTools: Record<string, VercelAIMcpTool> = {
        "server1::tool1": {
          description: "Tool 1",
          execute: vi.fn(),
          _mcpServerName: "server1",
          _mcpServerId: "server-id-1",
          _originToolName: "tool1",
        },
        "server1::tool2": {
          description: "Tool 2",
          execute: vi.fn(),
          _mcpServerName: "server1",
          _mcpServerId: "server-id-1",
          _originToolName: "tool2",
        },
        "server2::tool3": {
          description: "Tool 3",
          execute: vi.fn(),
          _mcpServerName: "server2",
          _mcpServerId: "server-id-2",
          _originToolName: "tool3",
        },
      };

      vi.mocked(gatewayService.getPresetTools).mockResolvedValue(mockTools);

      const server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      const status = await server.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.serverName).toBe("test-server");
      expect(status.version).toBe("1.0.0");
      expect(status.totalTools).toBe(3);
      expect(status.exposedServerCount).toBe(2);
    });
  });
});
