ALTER TABLE "garment" ADD COLUMN "upload_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "garment_owner_upload_unique" ON "garment" USING btree ("owner_id","upload_id");