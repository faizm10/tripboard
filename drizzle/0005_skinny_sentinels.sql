CREATE TYPE "public"."invitation_kind" AS ENUM('email', 'share');--> statement-breakpoint
CREATE TABLE "trip_invitation_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_invitations" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_invitations" ADD COLUMN "kind" "invitation_kind" DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_invitations" ADD COLUMN "role" "member_role" DEFAULT 'editor' NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_invitations" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trip_invitations" ADD COLUMN "revoked_by" text;--> statement-breakpoint
ALTER TABLE "trip_invitation_acceptances" ADD CONSTRAINT "trip_invitation_acceptances_invitation_id_trip_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."trip_invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_invitation_acceptances" ADD CONSTRAINT "trip_invitation_acceptances_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_invitation_acceptances_unique" ON "trip_invitation_acceptances" USING btree ("invitation_id","user_id");--> statement-breakpoint
CREATE INDEX "trip_invitation_acceptances_trip_idx" ON "trip_invitation_acceptances" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "trip_invitation_acceptances_user_idx" ON "trip_invitation_acceptances" USING btree ("user_id");