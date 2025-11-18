import { NextResponse } from "next/server";

import { mcpRepository } from "lib/db/repository";
import { getSession } from "lib/auth/server";

/**
 * GET /api/mcp/export
 *
 * Returns MCP server configurations for export in the CLI-compatible format.
 * Requires an authenticated user session.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
        },
      );
    }

    const userId = session.user.id;
    const servers = await mcpRepository.selectAll();

    const eligibleServers = servers.filter((server) => {
      if (!server.userId) {
        return true;
      }
      if (server.userId === userId) {
        return true;
      }
      if (server.visibility === "public") {
        return true;
      }
      return false;
    });

    const exportData = eligibleServers.reduce<Record<string, unknown>>(
      (acc, server) => {
        acc[server.name] = server.config;
        return acc;
      },
      {},
    );

    return NextResponse.json(exportData, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="mcp-config-${
          new Date().toISOString().split("T")[0]
        }.json"`,
      },
    });
  } catch (error) {
    console.error("MCP export error:", error);
    return NextResponse.json(
      { error: "Failed to export MCP configurations" },
      { status: 500 },
    );
  }
}
