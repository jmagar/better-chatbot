import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { VercelAIMcpTool } from "@/types/mcp";
import { GatewayService } from "./gateway-service";
import type { GatewayPresetConfig } from "./types";
import globalLogger from "@/lib/logger";
import {
  createToolsListHandler,
  createToolsCallHandler,
} from "./handlers/tools-handler";
import {
  createResourcesListHandler,
  createResourcesReadHandler,
} from "./handlers/resources-handler";
import {
  createPromptsListHandler,
  createPromptsGetHandler,
} from "./handlers/prompts-handler";
import { createSamplingCreateMessageHandler } from "./handlers/sampling-handler";
import { createElicitationCreateHandler } from "./handlers/elicitation-handler";
import { createRootsListHandler } from "./handlers/roots-handler";

/**
 * MCP Protocol Server for a specific preset or all capabilities
 * Wraps the GatewayService and exposes tools, resources, and prompts via MCP protocol
 */
export class MCPProtocolServer {
  private server: Server;
  private logger = globalLogger.withTag("MCP-Protocol");

  constructor(
    private gatewayService: GatewayService,
    private presetConfig: GatewayPresetConfig | null, // null = all capabilities
    private serverName: string,
  ) {
    this.server = new Server(
      {
        name: serverName,
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
          sampling: {},
          roots: {},
        },
      },
    );

    this.logger.info(`Initializing MCP server: ${serverName}`);
  }

  /**
   * Initialize the server by registering all handlers
   */
  async initialize(): Promise<void> {
    try {
      const tools = this.presetConfig
        ? await this.gatewayService.getPresetTools(this.presetConfig)
        : {}; // TODO: Implement get all tools

      this.logger.info(`Registering ${Object.keys(tools).length} tools`);

      // Register tools handlers
      const toolsListHandler = createToolsListHandler(tools);
      const toolsCallHandler = createToolsCallHandler(
        tools,
        this.gatewayService,
      );

      this.server.setRequestHandler({ method: "tools/list" }, toolsListHandler);
      this.server.setRequestHandler({ method: "tools/call" }, toolsCallHandler);

      // Register resources handlers
      const resourcesListHandler = createResourcesListHandler(
        this.gatewayService,
        this.presetConfig,
      );
      const resourcesReadHandler = createResourcesReadHandler(
        this.gatewayService,
      );

      this.server.setRequestHandler(
        { method: "resources/list" },
        resourcesListHandler,
      );
      this.server.setRequestHandler(
        { method: "resources/read" },
        resourcesReadHandler,
      );

      // Register prompts handlers
      const promptsListHandler = createPromptsListHandler(
        this.gatewayService,
        this.presetConfig,
      );
      const promptsGetHandler = createPromptsGetHandler(this.gatewayService);

      this.server.setRequestHandler(
        { method: "prompts/list" },
        promptsListHandler,
      );
      this.server.setRequestHandler(
        { method: "prompts/get" },
        promptsGetHandler,
      );

      // Register sampling handler
      const samplingCreateMessageHandler = createSamplingCreateMessageHandler(
        this.gatewayService,
        this.logger,
      );

      this.server.setRequestHandler(
        { method: "sampling/createMessage" },
        samplingCreateMessageHandler,
      );

      // Register elicitation handler
      const elicitationCreateHandler = createElicitationCreateHandler(
        this.gatewayService,
        this.logger,
      );

      this.server.setRequestHandler(
        { method: "elicitation/create" },
        elicitationCreateHandler,
      );

      // Register roots handler
      const rootsListHandler = createRootsListHandler(
        this.gatewayService,
        this.presetConfig,
      );

      this.server.setRequestHandler({ method: "roots/list" }, rootsListHandler);

      this.logger.info(
        `MCP server initialized with ${Object.keys(tools).length} tools, resources, prompts, sampling, elicitation, and roots`,
      );
    } catch (error) {
      this.logger.error("Failed to initialize MCP server", error);
      throw error;
    }
  }

  /**
   * Get the underlying MCP Server instance
   */
  getServer(): Server {
    return this.server;
  }

  /**
   * Get status information about the gateway
   */
  async getStatus(): Promise<{
    enabled: boolean;
    serverName: string;
    version: string;
    totalTools: number;
    totalResources: number;
    totalPrompts: number;
    totalRoots: number;
    exposedServerCount: number;
  }> {
    const tools = this.presetConfig
      ? await this.gatewayService.getPresetTools(this.presetConfig)
      : {};

    const resources = this.presetConfig
      ? await this.gatewayService.getPresetResources(this.presetConfig)
      : [];

    const prompts = this.presetConfig
      ? await this.gatewayService.getPresetPrompts(this.presetConfig)
      : [];

    const roots = this.presetConfig
      ? await this.gatewayService.getPresetRoots(this.presetConfig)
      : [];

    const serverIds = new Set(
      Object.values(tools).map((tool) => tool._mcpServerId),
    );

    return {
      enabled: true,
      serverName: this.serverName,
      version: "1.0.0",
      totalTools: Object.keys(tools).length,
      totalResources: resources.length,
      totalPrompts: prompts.length,
      totalRoots: roots.length,
      exposedServerCount: serverIds.size,
    };
  }
}
