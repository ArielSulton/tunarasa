CREATE TABLE "conversations" (
	"conversation_id" serial PRIMARY KEY NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "genders" (
	"gender_id" serial PRIMARY KEY NOT NULL,
	"gender_name" varchar(50) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "genders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "messages" (
	"message_id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"message_content" text NOT NULL,
	"is_user" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notes" (
	"note_id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"note_content" text NOT NULL,
	"url_access" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "roles" (
	"role_id" serial PRIMARY KEY NOT NULL,
	"role_name" varchar(50) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" integer,
	"full_name" varchar(255),
	"role_id" integer NOT NULL,
	"gender_id" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "conversations_user_id_idx" ON "conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversations_is_active_idx" ON "conversations" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "conversations_created_at_idx" ON "conversations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "genders_gender_name_idx" ON "genders" USING btree ("gender_name");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_is_user_idx" ON "messages" USING btree ("is_user");--> statement-breakpoint
CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notes_conversation_id_idx" ON "notes" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "notes_created_at_idx" ON "notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "roles_role_name_idx" ON "roles" USING btree ("role_name");--> statement-breakpoint
CREATE INDEX "users_clerk_user_id_idx" ON "users" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "users_role_id_idx" ON "users" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "users_gender_id_idx" ON "users" USING btree ("gender_id");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");