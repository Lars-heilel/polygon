ALTER TABLE "Message"
  ADD COLUMN "forwarded_from_sender_id" TEXT,
  ADD COLUMN "forwarded_from_created_at" TIMESTAMP(3);

CREATE INDEX "Message_forwarded_from_sender_id_idx" ON "Message"("forwarded_from_sender_id");
