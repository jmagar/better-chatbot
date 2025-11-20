import { describe, it, expect, beforeEach, vi } from "vitest";
import { MCPClient } from "./create-mcp-client";
import type { MCPServerConfig } from "app-types/mcp";

// Mock server-only modules
vi.mock("./pg-oauth-provider", () => ({
  PgOAuthClientProvider: vi.fn(),
}));

describe("MCPClient - Roots", () => {
  let client: MCPClient;
  const mockConfig: MCPServerConfig = {
    command: "node",
    args: ["server.js"],
  };

  beforeEach(() => {
    client = new MCPClient("test-id", "Test Server", mockConfig);
  });

  it("should list roots successfully", async () => {
    // @ts-expect-error - Accessing private client for testing
    client.client = {
      listRoots: vi.fn().mockResolvedValue({
        roots: [
          { uri: "file:///home/user/project", name: "Project Root" },
          { uri: "file:///workspace", name: "Workspace" },
        ],
      }),
    };
    // @ts-expect-error - Set connected for testing
    client.isConnected = true;

    const roots = await client.listRoots();

    expect(roots).toHaveLength(2);
    expect(roots[0]).toMatchObject({
      uri: "file:///home/user/project",
      name: "Project Root",
    });
  });

  it("should return empty array when no roots available", async () => {
    // @ts-expect-error - Accessing private client for testing
    client.client = {
      listRoots: vi.fn().mockResolvedValue({ roots: [] }),
    };
    // @ts-expect-error - Set connected for testing
    client.isConnected = true;

    const roots = await client.listRoots();

    expect(roots).toEqual([]);
  });

  it("should handle multiple roots from different mount points", async () => {
    // @ts-expect-error - Accessing private client for testing
    client.client = {
      listRoots: vi.fn().mockResolvedValue({
        roots: [
          { uri: "file:///", name: "System Root" },
          { uri: "file:///home/user", name: "User Home" },
          { uri: "file:///mnt/data", name: "Data Mount" },
        ],
      }),
    };
    // @ts-expect-error - Set connected for testing
    client.isConnected = true;

    const roots = await client.listRoots();

    expect(roots).toHaveLength(3);
    expect(roots[2].uri).toBe("file:///mnt/data");
  });

  it("should handle errors when listing roots", async () => {
    // @ts-expect-error - Accessing private client for testing
    client.client = {
      listRoots: vi.fn().mockRejectedValue(new Error("Connection failed")),
    };
    // @ts-expect-error - Set connected for testing
    client.isConnected = true;

    await expect(client.listRoots()).rejects.toThrow("Connection failed");
  });

  it("should include server context metadata in roots", async () => {
    // @ts-expect-error - Accessing private client for testing
    client.client = {
      listRoots: vi.fn().mockResolvedValue({
        roots: [{ uri: "file:///project", name: "Project" }],
      }),
    };
    // @ts-expect-error - Set connected for testing
    client.isConnected = true;

    const roots = await client.listRoots();

    expect(roots[0]._mcpServerId).toBe("test-id");
    expect(roots[0]._mcpServerName).toBe("Test Server");
  });
});
