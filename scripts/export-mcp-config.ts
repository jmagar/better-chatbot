/**
 * MCP Configuration Export Script
 *
 * Exports Model Context Protocol (MCP) server configurations from PostgreSQL
 * to a JSON file compatible with Claude Desktop and Claude Code CLI.
 *
 * Usage:
 *   pnpm mcp:export
 *   pnpm mcp:export --db-url="postgres://user:pass@host:5432/db"
 *   pnpm mcp:export --db-host="localhost"
 *
 * Environment Variables:
 *   POSTGRES_URL           - Database connection string (from .env)
 *   MCP_EXPORT_DB_URL      - Override database URL
 *   MCP_EXPORT_DB_HOST     - Override database host only
 *
 * Output:
 *   .mcp-config.json       - Exported configurations (gitignored, contains secrets)
 *
 * Documentation:
 *   See docs/mcp-export.md for detailed usage and troubleshooting
 *
 * @module scripts/export-mcp-config
 */

import "load-env";
import { promises as fs } from "fs";
import { resolve } from "path";
import type { McpServerSelect } from "app-types/mcp";
import { MCP_CONFIG_PATH } from "lib/ai/mcp/config-path";

/**
 * Command-line options for the export script
 */
type CliOptions = {
  /** Full database connection URL (overrides POSTGRES_URL) */
  dbUrl?: string;
  /** Database host override (modifies POSTGRES_URL hostname) */
  dbHost?: string;
};

/**
 * Parse command-line arguments and environment variables
 *
 * Supports multiple formats:
 *   --db-url="connection-string"
 *   --db-url "connection-string"
 *   --db-host="hostname"
 *   --db-host "hostname"
 *
 * Falls back to environment variables:
 *   MCP_EXPORT_DB_URL
 *   MCP_EXPORT_DB_HOST
 *
 * @param argv - Process arguments array (process.argv)
 * @returns Parsed CLI options
 */
function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};
  const normalized = argv.slice(2); // Skip 'node' and script path

  for (let i = 0; i < normalized.length; i += 1) {
    const arg = normalized[i];

    // Handle --db-url=value format
    if (arg.startsWith("--db-url=")) {
      options.dbUrl = arg.split("=")[1];
      continue;
    }
    // Handle --db-url value format
    if (arg === "--db-url") {
      options.dbUrl = normalized[i + 1];
      i += 1;
      continue;
    }

    // Handle --db-host=value format
    if (arg.startsWith("--db-host=")) {
      options.dbHost = arg.split("=")[1];
      continue;
    }
    // Handle --db-host value format
    if (arg === "--db-host") {
      options.dbHost = normalized[i + 1];
      i += 1;
      continue;
    }
  }

  // Fallback to environment variables if flags not provided
  if (!options.dbUrl && process.env.MCP_EXPORT_DB_URL) {
    options.dbUrl = process.env.MCP_EXPORT_DB_URL;
  }
  if (!options.dbHost && process.env.MCP_EXPORT_DB_HOST) {
    options.dbHost = process.env.MCP_EXPORT_DB_HOST;
  }

  return options;
}

/**
 * Prepare database configuration from CLI options and environment
 *
 * Priority order:
 *   1. --db-url flag (highest)
 *   2. MCP_EXPORT_DB_URL env var
 *   3. POSTGRES_URL from .env file (default)
 *
 * Host override (--db-host) modifies the hostname in POSTGRES_URL while
 * preserving credentials, port, and database name. Useful for switching
 * between Docker network names and localhost/Tailscale IPs.
 *
 * @param options - Parsed CLI options
 * @throws Error if POSTGRES_URL is not available
 * @throws Error if host override fails to parse URL
 */
function prepareDatabaseConfig(options: CliOptions): void {
  // Full URL override takes precedence
  if (options.dbUrl) {
    process.env.POSTGRES_URL = options.dbUrl;
    return;
  }

  // Ensure base POSTGRES_URL exists
  if (!process.env.POSTGRES_URL) {
    throw new Error(
      "POSTGRES_URL is not set. Provide it via env, --db-url, or MCP_EXPORT_DB_URL before running the exporter.",
    );
  }

  // Apply host override if provided
  if (options.dbHost) {
    try {
      const url = new URL(process.env.POSTGRES_URL);
      url.hostname = options.dbHost;
      process.env.POSTGRES_URL = url.toString();
    } catch (error) {
      throw new Error(
        `Failed to apply db host override (${options.dbHost}) to POSTGRES_URL: ${(error as Error).message}`,
      );
    }
  }
}

/**
 * Main export function
 *
 * Steps:
 *   1. Parse CLI arguments and prepare database connection
 *   2. Connect to PostgreSQL via Drizzle ORM
 *   3. Query all MCP server configurations
 *   4. Transform to JSON format (name → config mapping)
 *   5. Write to .mcp-config.json file
 *
 * @throws Error if database connection fails
 * @throws Error if query fails
 * @throws Error if file write fails
 */
async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  prepareDatabaseConfig(options);

  // Lazy import to ensure env vars are loaded first
  const { mcpRepository } = await import("lib/db/repository");

  let servers: McpServerSelect[];
  try {
    servers = await mcpRepository.selectAll();
  } catch (error: any) {
    // Provide helpful error message for connection failures
    if (error?.code === "ECONNREFUSED") {
      const host =
        options.dbHost ?? new URL(process.env.POSTGRES_URL!).hostname;
      console.error(
        `Could not connect to Postgres (${host}:5432). Ensure your database is running and env vars are loaded before exporting.`,
      );
    }
    throw error;
  }

  const exportPath = resolve(MCP_CONFIG_PATH);

  // Transform array of servers to {name: config} object
  const data = servers.reduce<Record<string, unknown>>(
    (acc, server) => {
      acc[server.name] = server.config;
      return acc;
    },
    {} as Record<string, unknown>,
  );

  // Write formatted JSON (2-space indentation for readability)
  await fs.writeFile(exportPath, JSON.stringify(data, null, 2));
  console.log(
    `Exported ${servers.length} MCP server${servers.length === 1 ? "" : "s"} to ${exportPath}`,
  );
}

// Execute main function and handle errors
main().catch((error) => {
  console.error("Failed to export MCP configs:", error);
  process.exit(1);
});
