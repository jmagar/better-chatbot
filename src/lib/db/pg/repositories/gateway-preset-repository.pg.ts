import { pgDb as db } from "@/lib/db/pg/db.pg";
import {
  McpGatewayPresetTable,
  McpGatewayServerTable,
  type GatewayPreset,
} from "@/lib/db/pg/schema.pg";
import { eq, and, desc } from "drizzle-orm";

// FIX: Strong validation with max lengths
export interface GatewayPresetCreate {
  userId: string;
  slug: string;
  name: string;
  description?: string;
  visibility?: "public" | "private" | "invite_only";
  metadata?: Record<string, unknown>;
}

export interface GatewayPresetUpdate {
  name?: string;
  description?: string;
  visibility?: "public" | "private" | "invite_only";
  status?: "active" | "disabled" | "archived";
  metadata?: Record<string, unknown>;
}

export interface GatewayPresetWithServers extends GatewayPreset {
  servers: Array<{
    id: string;
    presetId: string;
    mcpServerId: string;
    enabled: boolean;
    allowedToolNames: string[];
  }>;
}

function validateUserId(userId: string): void {
  if (!userId || typeof userId !== "string") {
    throw new Error("Invalid userId");
  }
  // UUID v4 format
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      userId,
    )
  ) {
    throw new Error("Invalid userId format");
  }
}

function validateSlug(slug: string): void {
  if (!slug || typeof slug !== "string") {
    throw new Error("Invalid slug");
  }
  // FIX: Strict slug validation
  if (slug.length < 3 || slug.length > 50) {
    throw new Error("Slug must be 3-50 characters");
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(
      "Invalid slug format: must be lowercase letters, numbers, and hyphens",
    );
  }
  if (slug.startsWith("-") || slug.endsWith("-")) {
    throw new Error("Slug cannot start or end with hyphen");
  }
}

function validateName(name: string): void {
  if (!name || typeof name !== "string") {
    throw new Error("Invalid name");
  }
  // FIX: Max length validation
  if (name.length < 1 || name.length > 100) {
    throw new Error("Name must be 1-100 characters");
  }
}

function validateDescription(description?: string): void {
  if (description && description.length > 500) {
    throw new Error("Description must be max 500 characters");
  }
}

export const pgGatewayPresetRepository = {
  async create(data: GatewayPresetCreate): Promise<GatewayPreset> {
    validateUserId(data.userId);
    validateSlug(data.slug);
    validateName(data.name);
    validateDescription(data.description);

    const [preset] = await db
      .insert(McpGatewayPresetTable)
      .values({
        userId: data.userId,
        slug: data.slug,
        name: data.name,
        description: data.description,
        visibility: data.visibility ?? "private",
        status: "active",
        metadata: data.metadata ?? null,
      })
      .returning();

    return preset;
  },

  async findById(id: string): Promise<GatewayPreset | null> {
    const [preset] = await db
      .select()
      .from(McpGatewayPresetTable)
      .where(eq(McpGatewayPresetTable.id, id))
      .limit(1);

    return preset ?? null;
  },

  // FIX: JOIN query to avoid N+1
  async findBySlugWithServers(
    slug: string,
  ): Promise<GatewayPresetWithServers | null> {
    validateSlug(slug);

    const result = await db
      .select()
      .from(McpGatewayPresetTable)
      .leftJoin(
        McpGatewayServerTable,
        eq(McpGatewayServerTable.presetId, McpGatewayPresetTable.id),
      )
      .where(eq(McpGatewayPresetTable.slug, slug));

    if (result.length === 0) return null;

    const preset = result[0].mcp_gateway_presets;
    const servers = result
      .map((row) => row.mcp_gateway_servers)
      .filter((s): s is NonNullable<typeof s> => s !== null);

    return { ...preset, servers };
  },

  async findActiveBySlugWithServers(
    slug: string,
  ): Promise<GatewayPresetWithServers | null> {
    validateSlug(slug);

    const result = await db
      .select()
      .from(McpGatewayPresetTable)
      .leftJoin(
        McpGatewayServerTable,
        eq(McpGatewayServerTable.presetId, McpGatewayPresetTable.id),
      )
      .where(
        and(
          eq(McpGatewayPresetTable.slug, slug),
          eq(McpGatewayPresetTable.status, "active"),
        ),
      );

    if (result.length === 0) return null;

    const preset = result[0].mcp_gateway_presets;
    const servers = result
      .map((row) => row.mcp_gateway_servers)
      .filter((s): s is NonNullable<typeof s> => s !== null);

    return { ...preset, servers };
  },

  async findAllForUser(userId: string): Promise<GatewayPreset[]> {
    validateUserId(userId);

    return db
      .select()
      .from(McpGatewayPresetTable)
      .where(eq(McpGatewayPresetTable.userId, userId))
      .orderBy(desc(McpGatewayPresetTable.createdAt));
  },

  async findBySlug(
    userId: string,
    slug: string,
  ): Promise<GatewayPreset | null> {
    validateUserId(userId);
    validateSlug(slug);

    const [preset] = await db
      .select()
      .from(McpGatewayPresetTable)
      .where(
        and(
          eq(McpGatewayPresetTable.userId, userId),
          eq(McpGatewayPresetTable.slug, slug),
        ),
      )
      .limit(1);

    return preset ?? null;
  },

  async update(id: string, data: GatewayPresetUpdate): Promise<GatewayPreset> {
    if (data.name) validateName(data.name);
    if (data.description) validateDescription(data.description);

    const [updated] = await db
      .update(McpGatewayPresetTable)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(McpGatewayPresetTable.id, id))
      .returning();

    if (!updated) {
      throw new Error(`Preset not found: ${id}`);
    }

    return updated;
  },

  async delete(id: string): Promise<void> {
    await db
      .delete(McpGatewayPresetTable)
      .where(eq(McpGatewayPresetTable.id, id));
  },
};
