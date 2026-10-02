-- Safe TEXT -> UUID conversion (hand-rewritten; Prisma emitted lossy DROP/ADD COLUMN).
-- Pattern: drop FK -> drop PKs -> ALTER TYPE ... USING col::uuid -> SET DEFAULT uuidv7()
-- on ids -> re-add PKs -> re-add FK. Indexes survive ALTER TYPE, NOT recreated.
-- Prisma-requested "category DROP DEFAULT" kept (aligns DB with schema, no default declared).

-- DropForeignKey
ALTER TABLE "media_references" DROP CONSTRAINT "media_references_file_id_fkey";

-- File: drop PK, convert 3 columns, default on id, re-add PK
ALTER TABLE "File" DROP CONSTRAINT "File_pkey";
ALTER TABLE "File" ALTER COLUMN "id" TYPE UUID USING "id"::uuid;
ALTER TABLE "File" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "File" ALTER COLUMN "uploader_id" TYPE UUID USING "uploader_id"::uuid;
ALTER TABLE "File" ALTER COLUMN "chat_id" TYPE UUID USING "chat_id"::uuid;
ALTER TABLE "File" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "File" ADD CONSTRAINT "File_pkey" PRIMARY KEY ("id");

-- media_references: drop PK, convert 3 columns, default on id, re-add PK
ALTER TABLE "media_references" DROP CONSTRAINT "media_references_pkey";
ALTER TABLE "media_references" ALTER COLUMN "id" TYPE UUID USING "id"::uuid;
ALTER TABLE "media_references" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "media_references" ALTER COLUMN "file_id" TYPE UUID USING "file_id"::uuid;
ALTER TABLE "media_references" ALTER COLUMN "owner_id" TYPE UUID USING "owner_id"::uuid;
ALTER TABLE "media_references" ADD CONSTRAINT "media_references_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "media_references" ADD CONSTRAINT "media_references_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
