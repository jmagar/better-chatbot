import { pgDb as db } from "@/lib/db/pg/db.pg";
import {
  McpGatewayEventTable,
  type GatewayEvent,
} from "@/lib/db/pg/schema.pg";
import { eq, and, desc } from "drizzle-orm";

export interface GatewayEventCreate {
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventData: Record<string, unknown>;
  userId: string;
}

export const pgGatewayEventsRepository = {
  async recordEvent(data: GatewayEventCreate): Promise<GatewayEvent> {
    const [event] = await db
      .insert(McpGatewayEventTable)
      .values(data)
      .returning();

    return event;
  },

  async getEventsForAggregate(
    aggregateId: string,
    aggregateType: string
  ): Promise<GatewayEvent[]> {
    return db
      .select()
      .from(McpGatewayEventTable)
      .where(
        and(
          eq(McpGatewayEventTable.aggregateId, aggregateId),
          eq(McpGatewayEventTable.aggregateType, aggregateType)
        )
      )
      .orderBy(desc(McpGatewayEventTable.occurredAt));
  },
};
