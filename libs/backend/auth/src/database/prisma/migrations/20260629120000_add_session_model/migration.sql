-- Rename RefreshToken to Session and add new fields
ALTER TABLE "RefreshToken" RENAME TO "Session";

-- Rename columns from snake_case (with @map) to camelCase (without @map)
ALTER TABLE "Session" RENAME COLUMN "token_hash" TO "tokenHash";
ALTER TABLE "Session" RENAME COLUMN "credentials_id" TO "credentialsId";
ALTER TABLE "Session" RENAME COLUMN "expires_at" TO "expiresAt";
ALTER TABLE "Session" RENAME COLUMN "revoked_at" TO "revokedAt";
ALTER TABLE "Session" RENAME COLUMN "created_at" TO "createdAt";

-- Rename primary key constraint
ALTER TABLE "Session" RENAME CONSTRAINT "RefreshToken_pkey" TO "Session_pkey";

-- Rename foreign key constraint
ALTER TABLE "Session" RENAME CONSTRAINT "RefreshToken_credentials_id_fkey" TO "Session_credentialsId_fkey";

-- Drop old index (will be recreated below)
DROP INDEX "RefreshToken_credentials_id_idx";

-- Rename unique index
ALTER INDEX "RefreshToken_token_hash_key" RENAME TO "Session_tokenHash_key";

-- Add new columns
ALTER TABLE "Session" ADD COLUMN "lastActiveAt" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN "ip" TEXT;
ALTER TABLE "Session" ADD COLUMN "country" TEXT;
ALTER TABLE "Session" ADD COLUMN "os" TEXT;
ALTER TABLE "Session" ADD COLUMN "browser" TEXT;
ALTER TABLE "Session" ADD COLUMN "device" TEXT;
ALTER TABLE "Session" ADD COLUMN "userAgent" TEXT;

-- Add new index on credentialsId
CREATE INDEX "Session_credentialsId_idx" ON "Session"("credentialsId");
