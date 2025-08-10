DROP INDEX "qa_logs_session_id_idx";--> statement-breakpoint
ALTER TABLE "qa_logs" ALTER COLUMN "conversation_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "qa_logs" DROP COLUMN "session_id";