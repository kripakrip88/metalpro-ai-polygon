import { PrismaClient } from "@prisma/client";
import { Logger } from "@nestjs/common";

const logger = new Logger("StartupMigrations");

const MIGRATIONS: Array<{ name: string; sql: string }> = [
  {
    name: "006_extraction_context",
    sql: "ALTER TABLE ai_documents ADD COLUMN IF NOT EXISTS extraction_context JSONB",
  },
  {
    name: "007_bom_extraction_jobs",
    sql: `CREATE TABLE IF NOT EXISTS bom_extraction_jobs (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      rfq_id        TEXT        NOT NULL,
      assemblies    JSONB       NOT NULL,
      status        TEXT        NOT NULL DEFAULT 'processing',
      file_path     TEXT,
      items_created INT,
      error_message TEXT,
      created_at    TIMESTAMPTZ DEFAULT now(),
      completed_at  TIMESTAMPTZ
    )`,
  },
];

export async function runStartupMigrations(prisma: PrismaClient): Promise<void> {
  for (const migration of MIGRATIONS) {
    try {
      await prisma.$executeRawUnsafe(migration.sql);
      logger.log(`Migration OK: ${migration.name}`);
    } catch (err) {
      // Log but do not crash — app starts regardless, DB state logged for diagnosis
      logger.warn(`Migration skipped (${migration.name}): ${(err as Error).message}`);
    }
  }
}
