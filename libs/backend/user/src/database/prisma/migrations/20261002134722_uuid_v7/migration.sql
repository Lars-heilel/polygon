-- Safe TEXT -> UUID conversion for User.id (no default: id comes from auth).
-- Prisma generates lossy DROP COLUMN / ADD COLUMN; rewritten by hand.
-- Pre-flight: all 161 ids UUID-shaped, cast safe.

-- Drop PK first
ALTER TABLE "User" DROP CONSTRAINT "User_pkey";

-- Convert type with USING cast (preserves data)
ALTER TABLE "User" ALTER COLUMN "id" TYPE UUID USING "id"::uuid;

-- Re-add PK (indexes on email/name survive ALTER TYPE, not recreated)
ALTER TABLE "User" ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
