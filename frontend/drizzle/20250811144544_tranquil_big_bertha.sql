DROP TABLE "genders" CASCADE;--> statement-breakpoint
DROP INDEX IF EXISTS "users_gender_id_idx";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "gender_id";