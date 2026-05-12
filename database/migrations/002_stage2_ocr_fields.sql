-- Stage 2: OCR fields
ALTER TABLE ai_documents
  ADD COLUMN IF NOT EXISTS raw_ocr_text TEXT,
  ADD COLUMN IF NOT EXISTS cleaned_ocr_text TEXT,
  ADD COLUMN IF NOT EXISTS ocr_confidence NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS ocr_page_count INTEGER,
  ADD COLUMN IF NOT EXISTS ocr_duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sha256_checksum TEXT,
  ADD COLUMN IF NOT EXISTS processing_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_lock_owner TEXT,
  ADD COLUMN IF NOT EXISTS ocr_metadata JSONB,
  ADD COLUMN IF NOT EXISTS ocr_preprocessing_version TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_documents_checksum
  ON ai_documents(sha256_checksum)
  WHERE sha256_checksum IS NOT NULL AND deleted_at IS NULL;
