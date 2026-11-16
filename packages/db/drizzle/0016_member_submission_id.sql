ALTER TABLE "member" ADD COLUMN "submission_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "member_submission_unique" ON "member" USING btree ("submission_id");