CREATE TABLE "institutions" (
	"institution_id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"logo_url" text,
	"contact_info" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "institutions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "institutions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rag_files" (
	"rag_file_id" serial PRIMARY KEY NOT NULL,
	"institution_id" integer NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_type" varchar(10) NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"description" text,
	"processing_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"pinecone_namespace" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rag_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "institution_id" integer;--> statement-breakpoint
ALTER TABLE "qa_logs" ADD COLUMN "institution_id" integer;--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_files" ADD CONSTRAINT "rag_files_institution_id_institutions_institution_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("institution_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_files" ADD CONSTRAINT "rag_files_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "institutions_slug_idx" ON "institutions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "institutions_is_active_idx" ON "institutions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "institutions_created_by_idx" ON "institutions" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "institutions_created_at_idx" ON "institutions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "rag_files_institution_id_idx" ON "rag_files" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "rag_files_file_type_idx" ON "rag_files" USING btree ("file_type");--> statement-breakpoint
CREATE INDEX "rag_files_processing_status_idx" ON "rag_files" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "rag_files_pinecone_namespace_idx" ON "rag_files" USING btree ("pinecone_namespace");--> statement-breakpoint
CREATE INDEX "rag_files_is_active_idx" ON "rag_files" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "rag_files_created_by_idx" ON "rag_files" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "rag_files_created_at_idx" ON "rag_files" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_institution_id_institutions_institution_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("institution_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_logs" ADD CONSTRAINT "qa_logs_institution_id_institutions_institution_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("institution_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversations_institution_id_idx" ON "conversations" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "qa_logs_institution_id_idx" ON "qa_logs" USING btree ("institution_id");