ALTER TABLE "garment" DROP CONSTRAINT "garment_warmth_range";--> statement-breakpoint
ALTER TABLE "garment" DROP CONSTRAINT "garment_formality_range";--> statement-breakpoint
ALTER TABLE "garment" ALTER COLUMN "warmth" SET DEFAULT 2;--> statement-breakpoint
ALTER TABLE "garment" ALTER COLUMN "formality" SET DEFAULT 2;--> statement-breakpoint
ALTER TABLE "garment" ADD CONSTRAINT "garment_warmth_range" CHECK ("garment"."warmth" between 1 and 3);--> statement-breakpoint
ALTER TABLE "garment" ADD CONSTRAINT "garment_formality_range" CHECK ("garment"."formality" between 1 and 3);