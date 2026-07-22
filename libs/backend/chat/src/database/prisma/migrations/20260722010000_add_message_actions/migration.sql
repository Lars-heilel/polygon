ALTER TABLE "Message" ADD COLUMN "edited_at" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "deleted_by_id" TEXT;

CREATE TABLE "message_deletions" (
  "message_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "message_deletions_pkey" PRIMARY KEY ("message_id", "user_id"),
  CONSTRAINT "message_deletions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "message_deletions_user_id_idx" ON "message_deletions"("user_id");
CREATE INDEX "Message_deleted_at_idx" ON "Message"("deleted_at");
