ALTER TABLE "Message" ADD COLUMN "client_id" TEXT;
CREATE INDEX "Message_chat_id_client_id_idx" ON "Message"("chat_id", "client_id");
