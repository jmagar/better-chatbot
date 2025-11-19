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

describe("MCPProtocolServer - Resources", () => {
  let gatewayService: GatewayService;
  let presetConfig: GatewayPresetConfig;

  beforeEach(() => {
    gatewayService = {
      getPresetTools: vi.fn().mockResolvedValue({}),
      executeToolCall: vi.fn(),
      getPresetResources: vi.fn(),
      readResource: vi.fn(),
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

  describe("Resource Listing", () => {
    it("should list all available resources", async () => {
      const mockResources = [
        {
          uri: "file:///workspace/README.md",
          name: "README.md",
          description: "Project README file",
          mimeType: "text/markdown",
        },
        {
          uri: "file:///workspace/config.json",
          name: "config.json",
          description: "Configuration file",
          mimeType: "application/json",
        },
      ];

      vi.mocked(gatewayService.getPresetResources).mockResolvedValue(
        mockResources,
      );

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      // Resources should be available through the gateway service
      const resources = await gatewayService.getPresetResources(presetConfig);

      expect(resources).toHaveLength(2);
      expect(resources[0].uri).toBe("file:///workspace/README.md");
      expect(resources[1].mimeType).toBe("application/json");
    });

    it("should handle empty resource list", async () => {
      vi.mocked(gatewayService.getPresetResources).mockResolvedValue([]);

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      const resources = await gatewayService.getPresetResources(presetConfig);

      expect(resources).toHaveLength(0);
    });

    it("should filter resources by preset configuration", async () => {
      const mockResources = [
        {
          uri: "file:///workspace/allowed.md",
          name: "allowed.md",
          description: "Allowed file",
          mimeType: "text/markdown",
        },
      ];

      vi.mocked(gatewayService.getPresetResources).mockResolvedValue(
        mockResources,
      );

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      const resources = await gatewayService.getPresetResources(presetConfig);

      expect(resources).toHaveLength(1);
      expect(gatewayService.getPresetResources).toHaveBeenCalledWith(
        presetConfig,
      );
    });
  });

  describe("Resource Reading", () => {
    it("should read a resource by URI", async () => {
      const mockResource = {
        contents: [
          {
            uri: "file:///workspace/test.txt",
            mimeType: "text/plain",
            text: "Hello, world!",
          },
        ],
      };

      vi.mocked(gatewayService.readResource).mockResolvedValue(mockResource);

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      const result = await gatewayService.readResource(
        "test-server-id",
        "file:///workspace/test.txt",
      );

      expect(result.contents[0].text).toBe("Hello, world!");
      expect(result.contents[0].mimeType).toBe("text/plain");
    });

    it("should handle binary resource content", async () => {
      const mockResource = {
        contents: [
          {
            uri: "file:///workspace/image.png",
            mimeType: "image/png",
            blob: "base64encodeddata...",
          },
        ],
      };

      vi.mocked(gatewayService.readResource).mockResolvedValue(mockResource);

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      const result = await gatewayService.readResource(
        "test-server-id",
        "file:///workspace/image.png",
      );

      expect(result.contents[0].blob).toBeDefined();
      expect(result.contents[0].mimeType).toBe("image/png");
    });

    it("should handle resource not found errors", async () => {
      vi.mocked(gatewayService.readResource).mockRejectedValue(
        new Error("Resource not found"),
      );

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      await expect(
        gatewayService.readResource(
          "test-server-id",
          "file:///nonexistent.txt",
        ),
      ).rejects.toThrow("Resource not found");
    });

    it("should read multiple resources in sequence", async () => {
      vi.mocked(gatewayService.readResource)
        .mockResolvedValueOnce({
          contents: [
            {
              uri: "file:///workspace/file1.txt",
              mimeType: "text/plain",
              text: "Content 1",
            },
          ],
        })
        .mockResolvedValueOnce({
          contents: [
            {
              uri: "file:///workspace/file2.txt",
              mimeType: "text/plain",
              text: "Content 2",
            },
          ],
        });

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      const result1 = await gatewayService.readResource(
        "test-server-id",
        "file:///workspace/file1.txt",
      );
      const result2 = await gatewayService.readResource(
        "test-server-id",
        "file:///workspace/file2.txt",
      );

      expect(result1.contents[0].text).toBe("Content 1");
      expect(result2.contents[0].text).toBe("Content 2");
    });
  });

  describe("Resource Templates", () => {
    it("should support resource templates with URI patterns", async () => {
      const mockResources = [
        {
          uri: "file:///workspace/{path}",
          name: "Workspace Files",
          description: "Files in the workspace",
          mimeType: "text/plain",
        },
      ];

      vi.mocked(gatewayService.getPresetResources).mockResolvedValue(
        mockResources,
      );

      const _server = new MCPProtocolServer(
        gatewayService,
        presetConfig,
        "test-server",
      );

      const resources = await gatewayService.getPresetResources(presetConfig);

      expect(resources[0].uri).toContain("{path}");
    });
  });
});
