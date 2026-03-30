CREATE TABLE "helpdesk_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"user_id" text,
	"before_data" jsonb,
	"after_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "helpdesk_client_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"email" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "helpdesk_client_emails_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "helpdesk_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_name" text NOT NULL,
	"primary_email" text NOT NULL,
	"phone" text,
	"site_address" text,
	"sla_tier" text DEFAULT 'standard' NOT NULL,
	"response_sla_min" integer DEFAULT 480 NOT NULL,
	"resolution_sla_days" integer DEFAULT 3 NOT NULL,
	"notify_webhook" text,
	"bts_brain_org_id" text,
	"bts_site_client_id" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "helpdesk_kb_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"content" text NOT NULL,
	"excerpt" text,
	"category" text,
	"client_id" uuid,
	"is_published" boolean DEFAULT false NOT NULL,
	"source_ticket_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid,
	"tags" text[] DEFAULT '{}',
	"view_count" integer DEFAULT 0 NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "helpdesk_kb_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "helpdesk_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_user_id" uuid,
	"content" text NOT NULL,
	"content_html" text,
	"is_internal" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'portal' NOT NULL,
	"attachments" jsonb DEFAULT '[]',
	"email_from" text,
	"email_message_id" text,
	"call_sid" text,
	"recording_url" text,
	"transcription" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "helpdesk_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" text NOT NULL,
	"client_id" uuid,
	"created_by_user_id" uuid,
	"assigned_to_user_id" uuid,
	"subject" text NOT NULL,
	"category" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'portal' NOT NULL,
	"ai_category" text,
	"ai_priority" text,
	"ai_summary" text,
	"ai_draft_response" text,
	"ai_confidence" integer,
	"sla_response_due" timestamp with time zone,
	"sla_resolution_due" timestamp with time zone,
	"first_responded_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"sla_response_breached" boolean DEFAULT false NOT NULL,
	"sla_resolution_breached" boolean DEFAULT false NOT NULL,
	"total_minutes" integer DEFAULT 0 NOT NULL,
	"billable" boolean DEFAULT true NOT NULL,
	"inbound_email_id" text,
	"last_message_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "helpdesk_tickets_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE "helpdesk_time_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"minutes" integer NOT NULL,
	"description" text,
	"billable" boolean DEFAULT true NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "helpdesk_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "helpdesk_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "helpdesk_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"role" text DEFAULT 'client' NOT NULL,
	"password_hash" text,
	"client_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "helpdesk_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "helpdesk_client_emails" ADD CONSTRAINT "helpdesk_client_emails_client_id_helpdesk_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."helpdesk_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_kb_articles" ADD CONSTRAINT "helpdesk_kb_articles_client_id_helpdesk_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."helpdesk_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_kb_articles" ADD CONSTRAINT "helpdesk_kb_articles_source_ticket_id_helpdesk_tickets_id_fk" FOREIGN KEY ("source_ticket_id") REFERENCES "public"."helpdesk_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_kb_articles" ADD CONSTRAINT "helpdesk_kb_articles_created_by_user_id_helpdesk_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."helpdesk_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_kb_articles" ADD CONSTRAINT "helpdesk_kb_articles_updated_by_user_id_helpdesk_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."helpdesk_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_messages" ADD CONSTRAINT "helpdesk_messages_ticket_id_helpdesk_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."helpdesk_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_messages" ADD CONSTRAINT "helpdesk_messages_author_user_id_helpdesk_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."helpdesk_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_tickets" ADD CONSTRAINT "helpdesk_tickets_client_id_helpdesk_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."helpdesk_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_tickets" ADD CONSTRAINT "helpdesk_tickets_created_by_user_id_helpdesk_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."helpdesk_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_tickets" ADD CONSTRAINT "helpdesk_tickets_assigned_to_user_id_helpdesk_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."helpdesk_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_time_entries" ADD CONSTRAINT "helpdesk_time_entries_ticket_id_helpdesk_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."helpdesk_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_time_entries" ADD CONSTRAINT "helpdesk_time_entries_user_id_helpdesk_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."helpdesk_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_tokens" ADD CONSTRAINT "helpdesk_tokens_user_id_helpdesk_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."helpdesk_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_users" ADD CONSTRAINT "helpdesk_users_client_id_helpdesk_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."helpdesk_clients"("id") ON DELETE no action ON UPDATE no action;