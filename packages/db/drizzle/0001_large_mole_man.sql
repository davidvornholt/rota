ALTER TABLE "weather_day" ADD COLUMN "start_hour" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "weather_day" ADD COLUMN "end_hour" integer DEFAULT 24 NOT NULL;