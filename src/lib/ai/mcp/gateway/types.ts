export interface GatewayPresetConfig {
  id: string;
  userId: string;
  slug: string;
  name: string;
  description?: string;
  visibility: "public" | "private" | "invite_only";
  status: "active" | "disabled" | "archived";
  servers: GatewayServerConfig[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GatewayServerConfig {
  id: string;
  mcpServerId: string;
  enabled: boolean;
  allowedToolNames: string[];
}

export interface VercelAIMcpTool {
  _mcpServerId: string;
  _mcpServerName: string;
  _originToolName: string;
  description?: string;
  parameters: Record<string, unknown>;
  [key: string]: unknown;
}
