-- Add denormalized lastMessage columns to Chat
ALTER TABLE "Chat" ADD COLUMN "last_message_id" TEXT, ADD COLUMN "last_message_at" TIMESTAMP(3);

CREATE INDEX "Chat_lastMessageAt_idx" ON "Chat"("last_message_at");

-- Backfill denormalized lastMessage from the latest message per chat
UPDATE "Chat" c SET "last_message_id" = m."id", "last_message_at" = m."created_at"
FROM (SELECT DISTINCT ON ("chat_id") * FROM "Message" ORDER BY "chat_id", "created_at" DESC, "id" DESC) m
WHERE m."chat_id" = c."id";

-- Remove duplicate non-NULL (chat_id, client_id) pairs, keeping the earliest createdAt (id as tie-breaker)
DELETE FROM "Message" a USING "Message" b
WHERE a."chat_id" = b."chat_id"
  AND a."client_id" = b."client_id"
  AND a."client_id" IS NOT NULL
  AND (a."created_at" > b."created_at" OR (a."created_at" = b."created_at" AND a."id" > b."id"));

-- Replace the non-unique (chat_id, client_id) index with a partial scoped unique index (NULL clientIds stay non-unique)
DROP INDEX IF EXISTS "Message_chat_id_client_id_idx";
CREATE UNIQUE INDEX "Message_chatId_clientId_partial_key" ON "Message"("chat_id", "client_id") WHERE "client_id" IS NOT NULL;

-- Widen the history index with a deterministic id tie-breaker
DROP INDEX IF EXISTS "Message_chat_id_created_at_idx";
CREATE INDEX "Message_chatId_createdAt_id_idx" ON "Message"("chat_id", "created_at" DESC, "id" DESC);
