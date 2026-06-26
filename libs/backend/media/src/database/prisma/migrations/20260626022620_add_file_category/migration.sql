/*
  Warnings:

  - Added the required column `category` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('AVATAR', 'IMAGE', 'AUDIO', 'VIDEO', 'FILE', 'VOICE', 'CIRCLE');

-- AlterTable
ALTER TABLE "File" ADD COLUMN     "category" "FileCategory" NOT NULL DEFAULT 'FILE';

-- Set category based on chat_id: if no chat_id it's an avatar, otherwise it's a file
UPDATE "File" SET "category" = 'AVATAR' WHERE "chat_id" IS NULL;
UPDATE "File" SET "category" = 'IMAGE' WHERE "chat_id" IS NOT NULL AND "mime_type" LIKE 'image/%';
UPDATE "File" SET "category" = 'FILE' WHERE "chat_id" IS NOT NULL AND "mime_type" NOT LIKE 'image/%';
