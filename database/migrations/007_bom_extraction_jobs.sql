-- bom_extraction_jobs: tracks upload-and-extract-bom requests for erp-metal polling
-- Note: table is also created by Prisma (prisma db push). This file is a reference backup.
CREATE TABLE IF NOT EXISTS bom_extraction_jobs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id        TEXT        NOT NULL,
  assemblies    JSONB       NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'processing',
  file_path     TEXT,
  items_created INT,
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ
);
