-- Domain CHECKs for TEXT type/category columns (enums intentionally live
-- in migration, not in the Prisma schema — see schema.spec.ts).
ALTER TABLE "chats" ADD CONSTRAINT "chats_type_check"
  CHECK ("type" IN ('DIRECT', 'GROUP', 'CHANNEL'));
ALTER TABLE "messages" ADD CONSTRAINT "messages_type_check"
  CHECK ("type" IN ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'VOICE', 'FILE', 'SYSTEM'));
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_category_check"
  CHECK ("category" IN ('IMAGE', 'VIDEO', 'CIRCLE', 'AUDIO', 'VOICE', 'FILE'));
ALTER TABLE "message_forward_contexts" ADD CONSTRAINT "message_forward_contexts_type_check"
  CHECK ("original_message_type" IN ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'VOICE', 'FILE', 'SYSTEM'));
