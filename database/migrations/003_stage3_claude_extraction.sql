-- Stage 3: Claude Extraction
CREATE TABLE IF NOT EXISTS ai_extraction_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES ai_documents(id),
  model_provider TEXT NOT NULL,
  model_version TEXT NOT NULL,
  extraction_schema_version TEXT NOT NULL DEFAULT 'v1.0',
  prompt_snapshot JSONB NOT NULL,
  raw_response TEXT NOT NULL DEFAULT '',
  parsed_json JSONB,
  status TEXT NOT NULL DEFAULT 'queued',
  tokens_input INTEGER,
  tokens_output INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_extraction_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  extraction_run_id UUID NOT NULL REFERENCES ai_extraction_runs(id),
  document_id UUID NOT NULL REFERENCES ai_documents(id),
  raw_text TEXT NOT NULL,
  fields_with_confidence JSONB NOT NULL,
  item_confidence NUMERIC(5,4),
  page_number INTEGER,
  line_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_unparsed_fragments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  extraction_run_id UUID NOT NULL REFERENCES ai_extraction_runs(id),
  document_id UUID NOT NULL REFERENCES ai_documents(id),
  raw_text TEXT NOT NULL,
  reason TEXT,
  page_number INTEGER,
  line_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_documents
  ADD COLUMN IF NOT EXISTS ai_queued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_error TEXT;
