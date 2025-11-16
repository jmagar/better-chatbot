import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MCPClientsManager } from "@/lib/ai/mcp/create-mcp-clients-manager";

vi.mock("@/lib/ai/mcp/create-mcp-clients-manager");

describe("GatewayService", () => {
  // biome-ignore lint/suspicious/noExplicitAny: dynamic import type
  let GatewayService: any;
  let mockMcpManager: Partial<MCPClientsManager>;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockMcpManager = {
      tools: vi.fn(),
      toolCall: vi.fn(),
    };

    const module = await import("@/lib/ai/mcp/gateway/gateway-service");
    GatewayService = module.GatewayService;
  });

  it("should filter tools by server and allowed names", async () => {
    const allTools = {
      server1_tool1: {
        _mcpServerId: "server1",
        _mcpServerName: "Server 1",
        _originToolName: "tool1",
        description: "Tool 1",
        parameters: {},
      },
      server1_tool2: {
        _mcpServerId: "server1",
        _mcpServerName: "Server 1",
        _originToolName: "tool2",
        description: "Tool 2",
        parameters: {},
      },
      server2_tool3: {
        _mcpServerId: "server2",
        _mcpServerName: "Server 2",
        _originToolName: "tool3",
        description: "Tool 3",
        parameters: {},
      },
    };

    (mockMcpManager.tools as any).mockResolvedValue(allTools);

    const config = {
      id: "preset-1",
      userId: "user-1",
      slug: "test",
      name: "Test",
      visibility: "public" as const,
      status: "active" as const,
      servers: [
        {
          id: "gs-1",
          mcpServerId: "server1",
          enabled: true,
          allowedToolNames: ["tool1"], // Only tool1 allowed
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const service = new GatewayService(mockMcpManager as MCPClientsManager);
    const filteredTools = await service.getPresetTools(config);

    expect(Object.keys(filteredTools)).toHaveLength(1);
    expect(filteredTools["server1_tool1"]).toBeDefined();
    expect(filteredTools["server1_tool2"]).toBeUndefined();
  });

  it("should include all tools when allowedToolNames is empty", async () => {
    const allTools = {
      server1_tool1: {
        _mcpServerId: "server1",
        _originToolName: "tool1",
      },
      server1_tool2: {
        _mcpServerId: "server1",
        _originToolName: "tool2",
      },
    };

    (mockMcpManager.tools as any).mockResolvedValue(allTools);

    const config = {
      id: "preset-1",
      userId: "user-1",
      slug: "test",
      name: "Test",
      visibility: "public" as const,
      status: "active" as const,
      servers: [
        {
          id: "gs-1",
          mcpServerId: "server1",
          enabled: true,
          allowedToolNames: [], // Empty = all tools
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const service = new GatewayService(mockMcpManager as MCPClientsManager);
    const filteredTools = await service.getPresetTools(config);

    expect(Object.keys(filteredTools)).toHaveLength(2);
  });

  it("should exclude disabled servers", async () => {
    const allTools = {
      server1_tool1: {
        _mcpServerId: "server1",
        _originToolName: "tool1",
      },
    };

    (mockMcpManager.tools as any).mockResolvedValue(allTools);

    const config = {
      id: "preset-1",
      userId: "user-1",
      slug: "test",
      name: "Test",
      visibility: "public" as const,
      status: "active" as const,
      servers: [
        {
          id: "gs-1",
          mcpServerId: "server1",
          enabled: false, // Disabled
          allowedToolNames: [],
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const service = new GatewayService(mockMcpManager as MCPClientsManager);
    const filteredTools = await service.getPresetTools(config);

    expect(Object.keys(filteredTools)).toHaveLength(0);
  });

  it("should return empty object for disabled preset", async () => {
    const config = {
      id: "preset-1",
      userId: "user-1",
      slug: "test",
      name: "Test",
      visibility: "public" as const,
      status: "disabled" as const,
      servers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const service = new GatewayService(mockMcpManager as MCPClientsManager);
    const filteredTools = await service.getPresetTools(config);

    expect(Object.keys(filteredTools)).toHaveLength(0);
  });

  it("should call tool with circuit breaker and timeout", async () => {
    (mockMcpManager.toolCall as any).mockResolvedValue({
      result: "success",
    });

    const service = new GatewayService(mockMcpManager as MCPClientsManager);

    const result = await service.executeToolCall("server1", "tool1", {
      param: "value",
    });

    expect(result).toEqual({ result: "success" });
    expect(mockMcpManager.toolCall).toHaveBeenCalledWith("server1", "tool1", {
      param: "value",
    });
  });
});
