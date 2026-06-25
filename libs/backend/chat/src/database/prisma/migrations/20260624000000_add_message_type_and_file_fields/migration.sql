-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'VOICE', 'FILE', 'SYSTEM');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "type" "MessageType" NOT NULL DEFAULT 'TEXT';
ALTER TABLE "Message" ADD COLUMN "file_id" TEXT;
ALTER TABLE "Message" ADD COLUMN "file_bucket" TEXT;
ALTER TABLE "Message" ADD COLUMN "file_key" TEXT;
ALTER TABLE "Message" ADD COLUMN "file_name" TEXT;
ALTER TABLE "Message" ADD COLUMN "file_size" INTEGER;
ALTER TABLE "Message" ADD COLUMN "file_mime" TEXT;
ALTER TABLE "Message" ADD COLUMN "forwarded_from_id" TEXT;
