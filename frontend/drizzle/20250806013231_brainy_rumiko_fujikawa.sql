CREATE TABLE "admin_invitations" (
	"invitation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"invited_by" integer NOT NULL,
	"custom_message" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "admin_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "admin_queue" (
	"queue_id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"assigned_admin_id" integer,
	"priority" varchar(10) DEFAULT 'normal' NOT NULL,
	"status" varchar(20) DEFAULT 'waiting' NOT NULL,
	"queued_at" timestamp DEFAULT now() NOT NULL,
	"assigned_at" timestamp,
	"resolved_at" timestamp,
	CONSTRAINT "admin_queue_conversation_id_unique" UNIQUE("conversation_id")
);
--> statement-breakpoint
ALTER TABLE "admin_queue" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app_settings" (
	"setting_id" serial PRIMARY KEY NOT NULL,
	"setting_key" varchar(100) NOT NULL,
	"setting_value" text NOT NULL,
	"setting_type" varchar(20) DEFAULT 'string' NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "conversations" (
	"conversation_id" serial PRIMARY KEY NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"user_agent" text,
	"ip_address" varchar(45),
	"service_mode" varchar(20) DEFAULT 'full_llm_bot' NOT NULL,
	"assigned_admin_id" integer,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"priority" varchar(10) DEFAULT 'normal' NOT NULL,
	"last_message_at" timestamp DEFAULT now(),
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "genders" (
	"gender_id" serial PRIMARY KEY NOT NULL,
	"gender_name" varchar(50) NOT NULL,
	CONSTRAINT "genders_gender_name_unique" UNIQUE("gender_name")
);
--> statement-breakpoint
ALTER TABLE "genders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "messages" (
	"message_id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"message_content" text NOT NULL,
	"message_type" varchar(20) DEFAULT 'user' NOT NULL,
	"admin_id" integer,
	"parent_message_id" integer,
	"confidence" integer,
	"is_read" boolean DEFAULT false NOT NULL,
	"input_method" varchar(20) DEFAULT 'text',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notes" (
	"note_id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"note_content" text NOT NULL,
	"title" varchar(255),
	"url_access" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "qa_logs" (
	"qa_id" serial PRIMARY KEY NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"conversation_id" integer,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"confidence" integer,
	"response_time" integer,
	"gesture_input" text,
	"context_used" text,
	"evaluation_score" integer,
	"service_mode" varchar(20) DEFAULT 'full_llm_bot' NOT NULL,
	"responded_by" varchar(20) DEFAULT 'llm' NOT NULL,
	"admin_id" integer,
	"llm_recommendation_used" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "qa_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "roles" (
	"role_id" serial PRIMARY KEY NOT NULL,
	"role_name" varchar(50) NOT NULL,
	"description" text,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_role_name_unique" UNIQUE("role_name")
);
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_id" serial PRIMARY KEY NOT NULL,
	"anonymous_session_id" varchar(255),
	"user_id" integer,
	"session_type" varchar(20) DEFAULT 'anonymous' NOT NULL,
	"session_start" timestamp DEFAULT now() NOT NULL,
	"session_end" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"user_agent" text,
	"ip_address" varchar(45),
	"device_info" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_sync_log" (
	"sync_id" serial PRIMARY KEY NOT NULL,
	"supabase_user_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"sync_status" varchar(20) DEFAULT 'success' NOT NULL,
	"error_message" text,
	"supabase_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_sync_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" serial PRIMARY KEY NOT NULL,
	"supabase_user_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"full_name" varchar(255),
	"image_url" text,
	"role_id" integer DEFAULT 3,
	"gender_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_sign_in_at" timestamp,
	"email_verified" boolean DEFAULT false NOT NULL,
	"user_metadata" jsonb,
	"invited_by" integer,
	"invited_at" timestamp,
	"invitation_accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_supabase_user_id_unique" UNIQUE("supabase_user_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_invited_by_users_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_queue" ADD CONSTRAINT "admin_queue_conversation_id_conversations_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("conversation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_queue" ADD CONSTRAINT "admin_queue_assigned_admin_id_users_user_id_fk" FOREIGN KEY ("assigned_admin_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_users_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_admin_id_users_user_id_fk" FOREIGN KEY ("assigned_admin_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("conversation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_admin_id_users_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_conversation_id_conversations_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("conversation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_logs" ADD CONSTRAINT "qa_logs_conversation_id_conversations_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("conversation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_logs" ADD CONSTRAINT "qa_logs_admin_id_users_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("role_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_gender_id_genders_gender_id_fk" FOREIGN KEY ("gender_id") REFERENCES "public"."genders"("gender_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_invitations_email_idx" ON "admin_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "admin_invitations_status_idx" ON "admin_invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "admin_invitations_token_idx" ON "admin_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "admin_invitations_expires_at_idx" ON "admin_invitations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "admin_invitations_invited_by_idx" ON "admin_invitations" USING btree ("invited_by");--> statement-breakpoint
CREATE INDEX "admin_queue_status_idx" ON "admin_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "admin_queue_priority_idx" ON "admin_queue" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "admin_queue_assigned_admin_id_idx" ON "admin_queue" USING btree ("assigned_admin_id");--> statement-breakpoint
CREATE INDEX "admin_queue_queued_at_idx" ON "admin_queue" USING btree ("queued_at");--> statement-breakpoint
CREATE INDEX "app_settings_setting_key_idx" ON "app_settings" USING btree ("setting_key");--> statement-breakpoint
CREATE INDEX "app_settings_is_public_idx" ON "app_settings" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "app_settings_updated_at_idx" ON "app_settings" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "conversations_session_id_idx" ON "conversations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "conversations_is_active_idx" ON "conversations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "conversations_service_mode_idx" ON "conversations" USING btree ("service_mode");--> statement-breakpoint
CREATE INDEX "conversations_assigned_admin_id_idx" ON "conversations" USING btree ("assigned_admin_id");--> statement-breakpoint
CREATE INDEX "conversations_status_idx" ON "conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "conversations_last_message_at_idx" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "conversations_created_at_idx" ON "conversations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "genders_gender_name_idx" ON "genders" USING btree ("gender_name");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_message_type_idx" ON "messages" USING btree ("message_type");--> statement-breakpoint
CREATE INDEX "messages_admin_id_idx" ON "messages" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "messages_parent_message_id_idx" ON "messages" USING btree ("parent_message_id");--> statement-breakpoint
CREATE INDEX "messages_is_read_idx" ON "messages" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notes_conversation_id_idx" ON "notes" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "notes_created_at_idx" ON "notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "qa_logs_session_id_idx" ON "qa_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "qa_logs_conversation_id_idx" ON "qa_logs" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "qa_logs_service_mode_idx" ON "qa_logs" USING btree ("service_mode");--> statement-breakpoint
CREATE INDEX "qa_logs_responded_by_idx" ON "qa_logs" USING btree ("responded_by");--> statement-breakpoint
CREATE INDEX "qa_logs_admin_id_idx" ON "qa_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "qa_logs_created_at_idx" ON "qa_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "qa_logs_confidence_idx" ON "qa_logs" USING btree ("confidence");--> statement-breakpoint
CREATE INDEX "qa_logs_evaluation_score_idx" ON "qa_logs" USING btree ("evaluation_score");--> statement-breakpoint
CREATE INDEX "roles_role_name_idx" ON "roles" USING btree ("role_name");--> statement-breakpoint
CREATE INDEX "roles_is_active_idx" ON "roles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "sessions_anonymous_session_id_idx" ON "sessions" USING btree ("anonymous_session_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_session_type_idx" ON "sessions" USING btree ("session_type");--> statement-breakpoint
CREATE INDEX "sessions_is_active_idx" ON "sessions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "sessions_session_start_idx" ON "sessions" USING btree ("session_start");--> statement-breakpoint
CREATE INDEX "sessions_created_at_idx" ON "sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_sync_log_supabase_user_id_idx" ON "user_sync_log" USING btree ("supabase_user_id");--> statement-breakpoint
CREATE INDEX "user_sync_log_event_type_idx" ON "user_sync_log" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "user_sync_log_sync_status_idx" ON "user_sync_log" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "user_sync_log_created_at_idx" ON "user_sync_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "users_supabase_user_id_idx" ON "users" USING btree ("supabase_user_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_id_idx" ON "users" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "users_gender_id_idx" ON "users" USING btree ("gender_id");--> statement-breakpoint
CREATE INDEX "users_is_active_idx" ON "users" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "users_invited_by_idx" ON "users" USING btree ("invited_by");