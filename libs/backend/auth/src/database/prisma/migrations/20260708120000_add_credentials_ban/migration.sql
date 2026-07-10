ALTER TABLE "Credentials"
ADD COLUMN "is_banned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "banned_until" TIMESTAMP(3),
ADD COLUMN "ban_reason" TEXT,
ADD COLUMN "banned_at" TIMESTAMP(3),
ADD COLUMN "banned_by" TEXT;
