import { pgDb as db } from "@/lib/db/pg/db.pg";
import {
  McpGatewayMetricsTable,
  type GatewayMetric,
} from "@/lib/db/pg/schema.pg";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const METRICS_TTL_DAYS = 90;

export interface GatewayMetricCreate {
  presetId: string;
  toolName: string;
  success: boolean;
  executionTimeMs?: number;
  userId?: string;
  errorMessage?: string;
}

export const pgGatewayMetricsRepository = {
  async recordToolCall(data: GatewayMetricCreate): Promise<GatewayMetric> {
    // FIX: Set TTL for automatic cleanup
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + METRICS_TTL_DAYS);

    const [metric] = await db
      .insert(McpGatewayMetricsTable)
      .values({
        ...data,
        expiresAt,
        executedAt: new Date(),
      })
      .returning();

    return metric;
  },

  async getMetricsForPreset(
    presetId: string,
    startDate: Date,
    endDate: Date
  ): Promise<GatewayMetric[]> {
    return db
      .select()
      .from(McpGatewayMetricsTable)
      .where(
        and(
          eq(McpGatewayMetricsTable.presetId, presetId),
          gte(McpGatewayMetricsTable.executedAt, startDate),
          lte(McpGatewayMetricsTable.executedAt, endDate)
        )
      );
  },

  async getAggregatedStats(presetId: string, startDate: Date, endDate: Date) {
    const result = await db
      .select({
        totalCalls: sql<number>`count(*)`,
        successfulCalls: sql<number>`count(*) filter (where ${McpGatewayMetricsTable.success})`,
        avgExecutionTimeMs: sql<number>`avg(${McpGatewayMetricsTable.executionTimeMs})`,
      })
      .from(McpGatewayMetricsTable)
      .where(
        and(
          eq(McpGatewayMetricsTable.presetId, presetId),
          gte(McpGatewayMetricsTable.executedAt, startDate),
          lte(McpGatewayMetricsTable.executedAt, endDate)
        )
      );

    return result[0];
  },

  // FIX: Cleanup expired metrics (to be called by cron job)
  async cleanupExpiredMetrics(): Promise<number> {
    const result = await db
      .delete(McpGatewayMetricsTable)
      .where(lte(McpGatewayMetricsTable.expiresAt, new Date()))
      .returning({ id: McpGatewayMetricsTable.id });

    return result.length;
  },
};
