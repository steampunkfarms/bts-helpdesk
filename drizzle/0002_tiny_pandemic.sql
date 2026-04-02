CREATE TABLE "helpdesk_chatbot_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"messages" jsonb DEFAULT '[]' NOT NULL,
	"kb_articles_cited" text[] DEFAULT '{}',
	"was_escalated" boolean DEFAULT false NOT NULL,
	"escalated_at" timestamp with time zone,
	"feedback_rating" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "helpdesk_kb_articles" ADD COLUMN "embedding" text;--> statement-breakpoint
ALTER TABLE "helpdesk_tickets" ADD COLUMN "resolved_by" text;--> statement-breakpoint
ALTER TABLE "helpdesk_tickets" ADD COLUMN "chatbot_session_id" text;--> statement-breakpoint
ALTER TABLE "helpdesk_chatbot_sessions" ADD CONSTRAINT "helpdesk_chatbot_sessions_ticket_id_helpdesk_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."helpdesk_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_chatbot_sessions" ADD CONSTRAINT "helpdesk_chatbot_sessions_user_id_helpdesk_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."helpdesk_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_chatbot_sessions" ADD CONSTRAINT "helpdesk_chatbot_sessions_client_id_helpdesk_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."helpdesk_clients"("id") ON DELETE no action ON UPDATE no action;