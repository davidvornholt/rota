ALTER TABLE "public"."day_note" DROP CONSTRAINT "day_note_pkey";--> statement-breakpoint
ALTER TABLE "day_note" ALTER COLUMN "owner_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "garment" ALTER COLUMN "owner_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "proposal" ALTER COLUMN "owner_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "owner_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "wear_log" ALTER COLUMN "owner_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."weather_day" DROP CONSTRAINT "weather_day_pkey";--> statement-breakpoint
ALTER TABLE "weather_day" ALTER COLUMN "owner_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "day_note" ADD CONSTRAINT "day_note_owner_id_for_date_pk" PRIMARY KEY("owner_id","for_date");--> statement-breakpoint
ALTER TABLE "weather_day" ADD CONSTRAINT "weather_day_owner_id_for_date_pk" PRIMARY KEY("owner_id","for_date");