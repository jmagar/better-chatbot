import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { getSession } from "@/lib/auth/server";
import { MCPProtocolServer } from "@/lib/ai/mcp/gateway/mcp-protocol-server";
import { GatewayService } from "@/lib/ai/mcp/gateway/gateway-service";
import { mcpClientsManager } from "@/lib/ai/mcp/mcp-manager";
import { pgGatewayPresetRepository } from "@/lib/db/pg/repositories/gateway-preset-repository.pg";
import { NextRequest, NextResponse } from "next/server";
import globalLogger from "@/lib/logger";

const logger = globalLogger.withTag("MCP-Gateway-API");

// Create gateway service instance
const gatewayService = new GatewayService(mcpClientsManager);

// Cache for MCP servers by preset
const serverCache = new Map<string, MCPProtocolServer>();

/**
 * Parse the route segments to extract userId and optional preset slug
 * Expected formats:
 * - /api/mcp-gateway/[userId]/mcp -> { userId, preset: null }
 * - /api/mcp-gateway/[userId]/mcp/[preset] -> { userId, preset }
 */
function parseSegments(segments: string[] | undefined): {
  userId: string | null;
  presetSlug: string | null;
} {
  if (!segments || segments.length < 2) {
    return { userId: null, presetSlug: null };
  }

  const [userId, mcp, presetSlug] = segments;

  // Validate that second segment is "mcp"
  if (mcp !== "mcp") {
    return { userId: null, presetSlug: null };
  }

  return {
    userId,
    presetSlug: presetSlug || null,
  };
}

/**
 * Get or create MCP protocol server for the given preset
 */
async function getMCPServer(
  userId: string,
  presetSlug: string | null,
): Promise<MCPProtocolServer> {
  const cacheKey = `${userId}:${presetSlug || "all"}`;

  // Check cache
  if (serverCache.has(cacheKey)) {
    return serverCache.get(cacheKey)!;
  }

  // Fetch preset configuration if preset slug is provided
  let presetConfig = null;
  let serverName = `${userId}-gateway`;

  if (presetSlug) {
    // Fetch preset by slug with servers
    const presetWithServers =
      await pgGatewayPresetRepository.findBySlugWithServers(presetSlug);

    if (!presetWithServers) {
      throw new Error(`Preset not found: ${presetSlug}`);
    }

    // Verify the preset belongs to the user
    if (presetWithServers.userId !== userId) {
      throw new Error(`Preset not found: ${presetSlug}`);
    }

    presetConfig = {
      id: presetWithServers.id,
      userId: presetWithServers.userId,
      slug: presetWithServers.slug,
      name: presetWithServers.name,
      description: presetWithServers.description,
      visibility: presetWithServers.visibility,
      status: presetWithServers.status,
      servers: presetWithServers.servers.map((s) => ({
        id: s.id,
        mcpServerId: s.mcpServerId,
        enabled: s.enabled,
        allowedToolNames: s.allowedToolNames,
      })),
      createdAt: presetWithServers.createdAt,
      updatedAt: presetWithServers.updatedAt,
    };

    serverName = `${userId}-${presetSlug}`;
  }

  // Create new MCP protocol server
  const mcpServer = new MCPProtocolServer(
    gatewayService,
    presetConfig,
    serverName,
  );

  // Initialize the server (register tools)
  await mcpServer.initialize();

  // Cache the server
  serverCache.set(cacheKey, mcpServer);

  return mcpServer;
}

/**
 * Handle MCP protocol requests
 * Supports POST (requests), GET (SSE streaming), DELETE (session termination)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ segments?: string[] }> },
) {
  try {
    // Get authenticated session
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 },
      );
    }

    // Parse route segments
    const params = await context.params;
    const { userId, presetSlug } = parseSegments(params.segments);

    if (!userId) {
      return NextResponse.json(
        { error: "Invalid route format" },
        { status: 400 },
      );
    }

    // Verify user can access this gateway
    // Users can only access their own gateways
    if (session.user.id !== userId) {
      return NextResponse.json(
        { error: "Forbidden - You can only access your own gateway" },
        { status: 403 },
      );
    }

    logger.info(
      `MCP gateway request from user ${userId}, preset: ${presetSlug || "all"}`,
    );

    // Get or create MCP server for this user/preset
    const mcpServer = await getMCPServer(userId, presetSlug);

    // Create transport for this request
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
    });

    // Connect the server to the transport
    await mcpServer.getServer().connect(transport);

    // Handle the request
    const requestBody = await request.json();
    const response = await transport.handleRequest(request as any, requestBody);

    return response;
  } catch (error: any) {
    logger.error("MCP gateway error:", error);
    return NextResponse.json(
      {
        error: error.message || "Internal server error",
      },
      { status: 500 },
    );
  }
}

/**
 * Handle GET requests for SSE streaming
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ segments?: string[] }> },
) {
  try {
    // Get authenticated session
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 },
      );
    }

    // Parse route segments
    const params = await context.params;
    const { userId, presetSlug } = parseSegments(params.segments);

    if (!userId) {
      return NextResponse.json(
        { error: "Invalid route format" },
        { status: 400 },
      );
    }

    // Verify user can access this gateway
    if (session.user.id !== userId) {
      return NextResponse.json(
        { error: "Forbidden - You can only access your own gateway" },
        { status: 403 },
      );
    }

    logger.info(
      `MCP gateway SSE from user ${userId}, preset: ${presetSlug || "all"}`,
    );

    // Get or create MCP server
    const mcpServer = await getMCPServer(userId, presetSlug);

    // Create transport
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
    });

    // Connect and handle
    await mcpServer.getServer().connect(transport);
    const response = await transport.handleRequest(request as any, null);

    return response;
  } catch (error: any) {
    logger.error("MCP gateway SSE error:", error);
    return NextResponse.json(
      {
        error: error.message || "Internal server error",
      },
      { status: 500 },
    );
  }
}

/**
 * Handle DELETE requests for session termination
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ segments?: string[] }> },
) {
  try {
    // Get authenticated session
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 },
      );
    }

    // Parse route segments
    const params = await context.params;
    const { userId, presetSlug } = parseSegments(params.segments);

    if (!userId) {
      return NextResponse.json(
        { error: "Invalid route format" },
        { status: 400 },
      );
    }

    // Verify user can access this gateway
    if (session.user.id !== userId) {
      return NextResponse.json(
        { error: "Forbidden - You can only access your own gateway" },
        { status: 403 },
      );
    }

    logger.info(
      `MCP gateway session termination from user ${userId}, preset: ${presetSlug || "all"}`,
    );

    // Clear cached server
    const cacheKey = `${userId}:${presetSlug || "all"}`;
    serverCache.delete(cacheKey);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error("MCP gateway DELETE error:", error);
    return NextResponse.json(
      {
        error: error.message || "Internal server error",
      },
      { status: 500 },
    );
  }
}
