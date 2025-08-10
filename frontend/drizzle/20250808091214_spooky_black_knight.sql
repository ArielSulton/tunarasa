ALTER TABLE "conversations" ALTER COLUMN "service_mode" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "service_mode" SET DEFAULT 'full_llm_bot';--> statement-breakpoint
ALTER TABLE "qa_logs" ALTER COLUMN "service_mode" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "qa_logs" ALTER COLUMN "service_mode" SET DEFAULT 'full_llm_bot';