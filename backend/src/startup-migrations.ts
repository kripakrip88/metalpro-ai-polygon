import { PrismaClient } from "@prisma/client";
import { Logger } from "@nestjs/common";

const logger = new Logger("StartupMigrations");

/**
 * Raw SQL migrations that cannot be handled by prisma db push
 * (legacy tables not in Prisma schema, column additions, etc.).
 * All statements must be idempotent.
 */
const MIGRATIONS: Array<{ name: string; sql: string }> = [
  {
    name: "006_extraction_context",
    sql: "ALTER TABLE ai_documents ADD COLUMN IF NOT EXISTS extraction_context JSONB",
  },
];

export async function runStartupMigrations(prisma: PrismaClient): Promise<void> {
  for (const migration of MIGRATIONS) {
    try {
      await prisma.$executeRawUnsafe(migration.sql);
      logger.log(`Migration OK: ${migration.name}`);
    } catch (err) {
      logger.error(`Migration FAILED: ${migration.name} — ${(err as Error).message}`);
      throw err;
    }
  }
}
