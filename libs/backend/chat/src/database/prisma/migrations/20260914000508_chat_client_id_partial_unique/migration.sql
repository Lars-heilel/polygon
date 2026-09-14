-- Idempotency guard for client-generated message ids: duplicate non-null
-- clientIds per chat are rejected, while NULL clientIds (server-generated
-- messages, forwards) stay unrestricted. Prisma cannot express partial
-- unique indexes in the schema, so it lives here as raw SQL.
CREATE UNIQUE INDEX "messages_chat_id_client_id_key" ON "messages"("chat_id", "client_id") WHERE "client_id" IS NOT NULL;
