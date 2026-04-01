CREATE TABLE "helpdesk_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"report_type" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"period_label" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now(),
	"pdf_url" text,
	"report_data" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"reviewed_by" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "helpdesk_rmm_agent_map" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rmm_agent_id" text NOT NULL,
	"hostname" text NOT NULL,
	"client_id" uuid NOT NULL,
	"machine_label" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "helpdesk_rmm_agent_map_rmm_agent_id_unique" UNIQUE("rmm_agent_id")
);
--> statement-breakpoint
CREATE TABLE "helpdesk_rmm_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rmm_alert_id" text NOT NULL,
	"rmm_agent_id" text,
	"hostname" text,
	"alert_type" text,
	"severity" text,
	"raw_payload" jsonb,
	"ticket_id" uuid,
	"dismissed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "helpdesk_rmm_alerts_rmm_alert_id_unique" UNIQUE("rmm_alert_id")
);
--> statement-breakpoint
ALTER TABLE "helpdesk_tickets" ADD COLUMN "is_proactive" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "helpdesk_reports" ADD CONSTRAINT "helpdesk_reports_client_id_helpdesk_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."helpdesk_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_rmm_agent_map" ADD CONSTRAINT "helpdesk_rmm_agent_map_client_id_helpdesk_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."helpdesk_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_rmm_alerts" ADD CONSTRAINT "helpdesk_rmm_alerts_ticket_id_helpdesk_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."helpdesk_tickets"("id") ON DELETE no action ON UPDATE no action;