ALTER TABLE "ChatMember"
  ADD COLUMN IF NOT EXISTS "last_read_message_id" TEXT,
  ADD COLUMN IF NOT EXISTS "last_read_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ChatMember_chat_id_last_read_at_idx"
  ON "ChatMember"("chat_id", "last_read_at");

ALTER TABLE "Chat"
  ADD COLUMN IF NOT EXISTS "self_owner_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Chat_self_owner_id_key"
  ON "Chat"("self_owner_id");

ALTER TABLE "ChatMember"
  DROP COLUMN IF EXISTS "unread_count";
