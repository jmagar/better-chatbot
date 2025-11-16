CREATE TABLE "mcp_gateway_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preset_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"granted_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_gateway_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"aggregate_type" varchar(50) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"event_data" jsonb NOT NULL,
	"user_id" uuid NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_gateway_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preset_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"executed_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"success" boolean NOT NULL,
	"execution_time_ms" integer,
	"user_id" uuid,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "mcp_gateway_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"visibility" varchar(20) DEFAULT 'private' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_gateway_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preset_id" uuid NOT NULL,
	"mcp_server_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"allowed_tool_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_gateway_access" ADD CONSTRAINT "mcp_gateway_access_preset_id_mcp_gateway_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."mcp_gateway_presets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_gateway_access" ADD CONSTRAINT "mcp_gateway_access_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_gateway_access" ADD CONSTRAINT "mcp_gateway_access_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_gateway_events" ADD CONSTRAINT "mcp_gateway_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_gateway_metrics" ADD CONSTRAINT "mcp_gateway_metrics_preset_id_mcp_gateway_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."mcp_gateway_presets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_gateway_metrics" ADD CONSTRAINT "mcp_gateway_metrics_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_gateway_presets" ADD CONSTRAINT "mcp_gateway_presets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_gateway_servers" ADD CONSTRAINT "mcp_gateway_servers_preset_id_mcp_gateway_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."mcp_gateway_presets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_gateway_servers" ADD CONSTRAINT "mcp_gateway_servers_mcp_server_id_mcp_server_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gateway_access_preset_user" ON "mcp_gateway_access" USING btree ("preset_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_gateway_access_user_id" ON "mcp_gateway_access" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_gateway_events_aggregate" ON "mcp_gateway_events" USING btree ("aggregate_id","aggregate_type");--> statement-breakpoint
CREATE INDEX "idx_gateway_events_user_id" ON "mcp_gateway_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_gateway_events_occurred_at" ON "mcp_gateway_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_gateway_metrics_preset_id" ON "mcp_gateway_metrics" USING btree ("preset_id");--> statement-breakpoint
CREATE INDEX "idx_gateway_metrics_executed_at" ON "mcp_gateway_metrics" USING btree ("executed_at");--> statement-breakpoint
CREATE INDEX "idx_gateway_metrics_expires_at" ON "mcp_gateway_metrics" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_gateway_metrics_user_id" ON "mcp_gateway_metrics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_gateway_presets_user_id" ON "mcp_gateway_presets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gateway_presets_slug" ON "mcp_gateway_presets" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "idx_gateway_presets_status" ON "mcp_gateway_presets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_gateway_presets_visibility" ON "mcp_gateway_presets" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "idx_gateway_servers_preset_id" ON "mcp_gateway_servers" USING btree ("preset_id");--> statement-breakpoint
CREATE INDEX "idx_gateway_servers_mcp_server_id" ON "mcp_gateway_servers" USING btree ("mcp_server_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gateway_servers_unique" ON "mcp_gateway_servers" USING btree ("preset_id","mcp_server_id");