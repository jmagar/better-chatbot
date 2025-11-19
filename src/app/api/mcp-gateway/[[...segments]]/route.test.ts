import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST, GET, DELETE } from "./route";
import { NextRequest } from "next/server";

// Mock dependencies
vi.mock("@/lib/auth/server", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/ai/mcp/gateway/mcp-protocol-server", () => ({
  MCPProtocolServer: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    getServer: vi.fn().mockReturnValue({
      connect: vi.fn(),
    }),
  })),
}));

vi.mock("@/lib/ai/mcp/gateway/gateway-service");
vi.mock("@/lib/ai/mcp/mcp-manager", () => ({
  mcpClientsManager: {},
}));

vi.mock("@/lib/db/pg/repositories/gateway-preset-repository.pg", () => ({
  pgGatewayPresetRepository: {
    findBySlugWithServers: vi.fn(),
  },
}));

vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
  StreamableHTTPServerTransport: vi.fn().mockImplementation(() => ({
    handleRequest: vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  })),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    withTag: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

import { getSession } from "@/lib/auth/server";
import { pgGatewayPresetRepository } from "@/lib/db/pg/repositories/gateway-preset-repository.pg";

describe("MCP Gateway API Routes", () => {
  const mockUserId = "test-user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST handler", () => {
    it("should return 401 when user is not authenticated", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost/api/mcp-gateway/user123/mcp",
        {
          method: "POST",
          body: JSON.stringify({ method: "tools/list" }),
        },
      );

      const context = {
        params: Promise.resolve({ segments: ["user123", "mcp"] }),
      };
      const response = await POST(request, context);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toContain("Unauthorized");
    });

    it("should return 400 for invalid route format", async () => {
      vi.mocked(getSession).mockResolvedValue({
        user: { id: mockUserId },
      } as any);

      const request = new NextRequest(
        "http://localhost/api/mcp-gateway/invalid",
        {
          method: "POST",
          body: JSON.stringify({ method: "tools/list" }),
        },
      );

      const context = { params: Promise.resolve({ segments: ["invalid"] }) };
      const response = await POST(request, context);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Invalid route format");
    });

    it("should return 403 when user tries to access another user's gateway", async () => {
      vi.mocked(getSession).mockResolvedValue({
        user: { id: "different-user-id" },
      } as any);

      const request = new NextRequest(
        `http://localhost/api/mcp-gateway/${mockUserId}/mcp`,
        {
          method: "POST",
          body: JSON.stringify({ method: "tools/list" }),
        },
      );

      const context = {
        params: Promise.resolve({ segments: [mockUserId, "mcp"] }),
      };
      const response = await POST(request, context);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toContain("Forbidden");
    });

    it("should handle preset-specific gateway requests", async () => {
      vi.mocked(getSession).mockResolvedValue({
        user: { id: mockUserId },
      } as any);

      vi.mocked(
        pgGatewayPresetRepository.findBySlugWithServers,
      ).mockResolvedValue({
        id: "preset-id",
        userId: mockUserId,
        slug: "my-preset",
        name: "My Preset",
        description: "Test preset",
        visibility: "private",
        status: "active",
        servers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const request = new NextRequest(
        `http://localhost/api/mcp-gateway/${mockUserId}/mcp/my-preset`,
        {
          method: "POST",
          body: JSON.stringify({ method: "tools/list" }),
        },
      );

      const context = {
        params: Promise.resolve({ segments: [mockUserId, "mcp", "my-preset"] }),
      };
      const response = await POST(request, context);

      expect(response.status).toBe(200);
      expect(
        pgGatewayPresetRepository.findBySlugWithServers,
      ).toHaveBeenCalledWith("my-preset");
    });
  });

  describe("GET handler", () => {
    it("should return 401 when user is not authenticated", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost/api/mcp-gateway/user123/mcp",
        {
          method: "GET",
        },
      );

      const context = {
        params: Promise.resolve({ segments: ["user123", "mcp"] }),
      };
      const response = await GET(request, context);

      expect(response.status).toBe(401);
    });

    it("should handle SSE requests for authenticated users", async () => {
      vi.mocked(getSession).mockResolvedValue({
        user: { id: mockUserId },
      } as any);

      const request = new NextRequest(
        `http://localhost/api/mcp-gateway/${mockUserId}/mcp`,
        {
          method: "GET",
        },
      );

      const context = {
        params: Promise.resolve({ segments: [mockUserId, "mcp"] }),
      };
      const response = await GET(request, context);

      expect(response.status).toBe(200);
    });
  });

  describe("DELETE handler", () => {
    it("should clear cached server on DELETE", async () => {
      vi.mocked(getSession).mockResolvedValue({
        user: { id: mockUserId },
      } as any);

      const request = new NextRequest(
        `http://localhost/api/mcp-gateway/${mockUserId}/mcp`,
        {
          method: "DELETE",
        },
      );

      const context = {
        params: Promise.resolve({ segments: [mockUserId, "mcp"] }),
      };
      const response = await DELETE(request, context);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
    });
  });

  describe("parseSegments helper", () => {
    it("should parse userId and mcp correctly", async () => {
      vi.mocked(getSession).mockResolvedValue({
        user: { id: mockUserId },
      } as any);

      const request = new NextRequest(
        `http://localhost/api/mcp-gateway/${mockUserId}/mcp`,
        {
          method: "POST",
          body: JSON.stringify({ method: "tools/list" }),
        },
      );

      const context = {
        params: Promise.resolve({ segments: [mockUserId, "mcp"] }),
      };
      const response = await POST(request, context);

      // Should successfully parse and not return 400
      expect(response.status).not.toBe(400);
    });

    it("should parse userId, mcp, and preset correctly", async () => {
      vi.mocked(getSession).mockResolvedValue({
        user: { id: mockUserId },
      } as any);

      vi.mocked(
        pgGatewayPresetRepository.findBySlugWithServers,
      ).mockResolvedValue({
        id: "preset-id",
        userId: mockUserId,
        slug: "test-preset",
        name: "Test Preset",
        visibility: "private",
        status: "active",
        servers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const request = new NextRequest(
        `http://localhost/api/mcp-gateway/${mockUserId}/mcp/test-preset`,
        {
          method: "POST",
          body: JSON.stringify({ method: "tools/list" }),
        },
      );

      const context = {
        params: Promise.resolve({
          segments: [mockUserId, "mcp", "test-preset"],
        }),
      };
      const _response = await POST(request, context);

      // Should successfully parse and fetch preset
      expect(
        pgGatewayPresetRepository.findBySlugWithServers,
      ).toHaveBeenCalledWith("test-preset");
    });
  });
});
