-- Stage 4: Llama + Telemetry
ALTER TABLE ai_extraction_runs
  ADD COLUMN IF NOT EXISTS memory_usage_mb INTEGER,
  ADD COLUMN IF NOT EXISTS input_was_truncated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS input_chars_sent INTEGER,
  ADD COLUMN IF NOT EXISTS items_extracted INTEGER,
  ADD COLUMN IF NOT EXISTS fragments_count INTEGER;

ALTER TABLE ai_documents
  ADD COLUMN IF NOT EXISTS llama_run_id UUID,
  ADD COLUMN IF NOT EXISTS llama_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS llama_failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS llama_error TEXT;

CREATE TABLE IF NOT EXISTS ai_extraction_telemetry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  extraction_run_id UUID NOT NULL REFERENCES ai_extraction_runs(id),
  document_id UUID NOT NULL REFERENCES ai_documents(id),
  event_type TEXT NOT NULL,
  model_provider TEXT NOT NULL,
  model_version TEXT,
  event_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_telemetry_run ON ai_extraction_telemetry(extraction_run_id);
CREATE INDEX idx_telemetry_event ON ai_extraction_telemetry(event_type);
CREATE INDEX idx_telemetry_provider ON ai_extraction_telemetry(model_provider);
