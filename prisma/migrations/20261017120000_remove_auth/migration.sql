-- Remove authentication: the app is single-tenant and has no users.
-- Repos become global. The repos rows are preserved.

-- Repos were unique per (userId, owner, name). Before the unique key drops the
-- user, collapse any duplicates of (owner, name), keeping the newest row.
DELETE FROM "repos" r
USING "repos" newer
WHERE r."owner" = newer."owner"
  AND r."name" = newer."name"
  AND r."id" <> newer."id"
  AND (r."createdAt", r."id") < (newer."createdAt", newer."id");

-- DropForeignKey
ALTER TABLE "repos" DROP CONSTRAINT "repos_userId_fkey";

-- DropIndex
DROP INDEX "repos_userId_idx";

-- DropIndex
DROP INDEX "repos_userId_owner_name_key";

-- AlterTable
ALTER TABLE "repos" DROP COLUMN "userId";

-- CreateIndex
CREATE UNIQUE INDEX "repos_owner_name_key" ON "repos"("owner", "name");

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_userId_fkey";

-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_userId_fkey";

-- DropTable
DROP TABLE "sessions";

-- DropTable
DROP TABLE "accounts";

-- DropTable
DROP TABLE "verifications";

-- DropTable
DROP TABLE "users";
