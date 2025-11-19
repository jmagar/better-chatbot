import { describe, it, expect, vi, beforeEach } from "vitest";
import { MCPClient } from "./create-mcp-client";
import type { MCPServerConfig } from "app-types/mcp";

// Mock server-only modules
vi.mock("./pg-oauth-provider", () => ({
  PgOAuthClientProvider: vi.fn(),
}));

describe("MCPClient - Resources Support", () => {
  let client: MCPClient;
  const mockConfig: MCPServerConfig = {
    url: "http://localhost:3000/mcp",
    headers: {},
  };

  beforeEach(() => {
    client = new MCPClient("test-id", "test-server", mockConfig);
  });

  describe("listResources", () => {
    it("should list available resources from connected server", async () => {
      // Mock the underlying client
      const mockClient = {
        listResources: vi.fn().mockResolvedValue({
          resources: [
            {
              uri: "file:///project/README.md",
              name: "README.md",
              description: "Project documentation",
              mimeType: "text/markdown",
            },
            {
              uri: "file:///project/src/index.ts",
              name: "index.ts",
              description: "Main entry point",
              mimeType: "text/typescript",
            },
          ],
        }),
      };

      // @ts-expect-error - mock private property
      client["client"] = mockClient;
      // @ts-expect-error
      client["isConnected"] = true;

      const resources = await client.listResources();

      expect(resources).toHaveLength(2);
      expect(resources[0]).toMatchObject({
        uri: "file:///project/README.md",
        name: "README.md",
        mimeType: "text/markdown",
      });
      expect(mockClient.listResources).toHaveBeenCalledTimes(1);
    });

    it("should return empty array when not connected", async () => {
      const resources = await client.listResources();
      expect(resources).toEqual([]);
    });

    it("should handle pagination with cursor", async () => {
      const mockClient = {
        listResources: vi.fn().mockResolvedValue({
          resources: [
            {
              uri: "file:///project/file1.ts",
              name: "file1.ts",
            },
          ],
          nextCursor: "page2",
        }),
      };

      // @ts-expect-error
      client["client"] = mockClient;
      // @ts-expect-error
      client["isConnected"] = true;

      const result = await client.listResources({ cursor: "page1" });

      expect(result).toHaveLength(1);
      expect(mockClient.listResources).toHaveBeenCalledWith({ cursor: "page1" });
    });

    it("should handle errors gracefully", async () => {
      const mockClient = {
        listResources: vi.fn().mockRejectedValue(new Error("Connection failed")),
      };

      // @ts-expect-error
      client["client"] = mockClient;
      // @ts-expect-error
      client["isConnected"] = true;

      const resources = await client.listResources();
      expect(resources).toEqual([]);
    });
  });

  describe("readResource", () => {
    it("should read resource content by URI", async () => {
      const mockClient = {
        readResource: vi.fn().mockResolvedValue({
          contents: [
            {
              uri: "file:///project/README.md",
              mimeType: "text/markdown",
              text: "# Project Title\n\nProject description",
            },
          ],
        }),
      };

      // @ts-expect-error
      client["client"] = mockClient;
      // @ts-expect-error
      client["isConnected"] = true;

      const content = await client.readResource("file:///project/README.md");

      expect(content).toBeDefined();
      expect(content.text).toContain("Project Title");
      expect(content.mimeType).toBe("text/markdown");
      expect(mockClient.readResource).toHaveBeenCalledWith({
        uri: "file:///project/README.md",
      });
    });

    it("should handle binary resources with blob data", async () => {
      const mockClient = {
        readResource: vi.fn().mockResolvedValue({
          contents: [
            {
              uri: "file:///project/image.png",
              mimeType: "image/png",
              blob: "base64encodeddata==",
            },
          ],
        }),
      };

      // @ts-expect-error
      client["client"] = mockClient;
      // @ts-expect-error
      client["isConnected"] = true;

      const content = await client.readResource("file:///project/image.png");

      expect(content).toBeDefined();
      expect(content.blob).toBe("base64encodeddata==");
      expect(content.mimeType).toBe("image/png");
    });

    it("should return null when not connected", async () => {
      const content = await client.readResource("file:///test.txt");
      expect(content).toBeNull();
    });

    it("should handle resource not found", async () => {
      const mockClient = {
        readResource: vi.fn().mockRejectedValue(new Error("Resource not found")),
      };

      // @ts-expect-error
      client["client"] = mockClient;
      // @ts-expect-error
      client["isConnected"] = true;

      const content = await client.readResource("file:///nonexistent.txt");
      expect(content).toBeNull();
    });
  });

  describe("listResourceTemplates", () => {
    it("should list available resource templates", async () => {
      const mockClient = {
        listResourceTemplates: vi.fn().mockResolvedValue({
          resourceTemplates: [
            {
              uriTemplate: "users://{userId}/profile",
              name: "user-profile",
              description: "User profile data",
              mimeType: "application/json",
            },
          ],
        }),
      };

      // @ts-expect-error
      client["client"] = mockClient;
      // @ts-expect-error
      client["isConnected"] = true;

      const templates = await client.listResourceTemplates();

      expect(templates).toHaveLength(1);
      expect(templates[0].uriTemplate).toBe("users://{userId}/profile");
      expect(mockClient.listResourceTemplates).toHaveBeenCalledTimes(1);
    });

    it("should return empty array when not connected", async () => {
      const templates = await client.listResourceTemplates();
      expect(templates).toEqual([]);
    });
  });
});
