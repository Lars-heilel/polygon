-- CreateIndex
CREATE INDEX "messages_chat_id_updated_at_id_idx" ON "messages"("chat_id", "updated_at", "id");
