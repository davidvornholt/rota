CREATE TABLE "proposal_backoff" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"for_date" date NOT NULL,
	"failures" integer NOT NULL,
	"last_failed_at" timestamp with time zone NOT NULL
);
