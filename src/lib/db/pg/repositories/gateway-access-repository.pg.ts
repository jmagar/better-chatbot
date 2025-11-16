import { pgDb as db } from "@/lib/db/pg/db.pg";
import {
  McpGatewayAccessTable,
  type GatewayAccess,
} from "@/lib/db/pg/schema.pg";
import { eq, and } from "drizzle-orm";

export interface GatewayAccessCreate {
  presetId: string;
  userId: string;
  grantedBy: string;
}

export const pgGatewayAccessRepository = {
  async grant(data: GatewayAccessCreate): Promise<GatewayAccess> {
    const [access] = await db
      .insert(McpGatewayAccessTable)
      .values(data)
      .returning();

    return access;
  },

  async findByPresetAndUser(
    presetId: string,
    userId: string
  ): Promise<GatewayAccess | null> {
    const [access] = await db
      .select()
      .from(McpGatewayAccessTable)
      .where(
        and(
          eq(McpGatewayAccessTable.presetId, presetId),
          eq(McpGatewayAccessTable.userId, userId)
        )
      )
      .limit(1);

    return access ?? null;
  },

  async revoke(presetId: string, userId: string): Promise<void> {
    await db
      .delete(McpGatewayAccessTable)
      .where(
        and(
          eq(McpGatewayAccessTable.presetId, presetId),
          eq(McpGatewayAccessTable.userId, userId)
        )
      );
  },

  async findAllForPreset(presetId: string): Promise<GatewayAccess[]> {
    return db
      .select()
      .from(McpGatewayAccessTable)
      .where(eq(McpGatewayAccessTable.presetId, presetId));
  },
};
