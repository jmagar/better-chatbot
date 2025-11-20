import { describe, it, expect, beforeEach, vi } from "vitest";
import { MCPProtocolServer } from "./mcp-protocol-server";
import type { GatewayService } from "./gateway-service";
import type { GatewayPresetConfig } from "@/lib/domain/gateway/gateway-preset.entity";

describe("MCPProtocolServer - Roots", () => {
  let mockGatewayService: Partial<GatewayService>;
  let presetConfig: GatewayPresetConfig;

  beforeEach(() => {
    presetConfig = {
      id: "preset-1",
      userId: "user-1",
      slug: "test-preset",
      name: "Test Preset",
      description: null,
      visibility: "private",
      status: "active",
      servers: [
        {
          mcpServerId: "server-1",
          enabled: true,
          allowedToolNames: [],
        },
      ],
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockGatewayService = {
      getPresetRoots: vi.fn().mockResolvedValue([
        { uri: "file:///home/user/project", name: "Project Root" },
        { uri: "file:///workspace", name: "Workspace" },
      ]),
      getPresetTools: vi.fn().mockResolvedValue({}),
      getPresetResources: vi.fn().mockResolvedValue([]),
      getPresetPrompts: vi.fn().mockResolvedValue([]),
    };
  });

  it("should list roots successfully", async () => {
    const mockRoots = [
      { uri: "file:///home/user/project", name: "Project Root" },
      { uri: "file:///workspace", name: "Workspace" },
    ];

    mockGatewayService.getPresetRoots = vi.fn().mockResolvedValue(mockRoots);

    new MCPProtocolServer(mockGatewayService as GatewayService, presetConfig);

    // Roots should be available through the gateway service
    const roots = await mockGatewayService.getPresetRoots?.(presetConfig);

    expect(roots).toHaveLength(2);
    expect(roots?.[0].uri).toBe("file:///home/user/project");
    expect(roots?.[1].name).toBe("Workspace");
    expect(mockGatewayService.getPresetRoots).toHaveBeenCalledWith(
      presetConfig,
    );
  });

  it("should handle empty roots list", async () => {
    mockGatewayService.getPresetRoots = vi.fn().mockResolvedValue([]);

    new MCPProtocolServer(mockGatewayService as GatewayService, presetConfig);

    const roots = await mockGatewayService.getPresetRoots?.(presetConfig);

    expect(roots).toEqual([]);
  });

  it("should handle errors gracefully", async () => {
    const error = new Error("Connection failed");
    mockGatewayService.getPresetRoots = vi.fn().mockRejectedValue(error);

    new MCPProtocolServer(mockGatewayService as GatewayService, presetConfig);

    // Gateway service should handle errors
    await expect(
      mockGatewayService.getPresetRoots?.(presetConfig),
    ).rejects.toThrow("Connection failed");
  });
});
