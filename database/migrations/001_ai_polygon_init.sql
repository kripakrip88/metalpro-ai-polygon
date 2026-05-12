-- MetalPro AI Polygon Initial Migration
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS n8n;

CREATE TABLE IF NOT EXISTS ai_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  storage_provider TEXT NOT NULL DEFAULT 'local',
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  file_size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  ocr_text TEXT,
  ocr_engine TEXT,
  ocr_started_at TIMESTAMPTZ,
  ocr_completed_at TIMESTAMPTZ,
  claude_result JSONB,
  claude_model TEXT,
  claude_prompt_version TEXT,
  claude_started_at TIMESTAMPTZ,
  claude_completed_at TIMESTAMPTZ,
  llama_result JSONB,
  llama_model TEXT,
  llama_prompt_version TEXT,
  llama_started_at TIMESTAMPTZ,
  llama_completed_at TIMESTAMPTZ,
  processing_error TEXT,
  failed_at TIMESTAMPTZ,
  n8n_execution_id TEXT,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  created_by TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS materials_dictionary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  normalized_name TEXT NOT NULL UNIQUE,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  material_group TEXT,
  unit TEXT,
  gost TEXT,
  steel_grade TEXT,
  dimensions JSONB,
  supplier_mapping JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_materials_dictionary_aliases ON materials_dictionary USING GIN(aliases);

CREATE TABLE IF NOT EXISTS ai_extraction_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES ai_documents(id),
  raw_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'claude',
  model_version TEXT,
  prompt_version TEXT,
  material_id UUID REFERENCES materials_dictionary(id),
  normalized_name TEXT,
  material_grade TEXT,
  quantity NUMERIC(12,3),
  unit TEXT,
  dimensions JSONB,
  confidence_score NUMERIC(5,4),
  status TEXT NOT NULL DEFAULT 'draft',
  user_corrected_name TEXT,
  user_corrected_qty NUMERIC(12,3),
  user_corrected_unit TEXT,
  user_notes TEXT,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES ai_documents(id),
  extraction_result_id UUID REFERENCES ai_extraction_results(id),
  ai_raw_text TEXT NOT NULL,
  ai_suggested_name TEXT,
  ai_suggested_qty NUMERIC(12,3),
  ai_suggested_unit TEXT,
  ai_source TEXT,
  ai_model_version TEXT,
  ai_prompt_version TEXT,
  ai_confidence NUMERIC(5,4),
  corrected_name TEXT,
  corrected_qty NUMERIC(12,3),
  corrected_unit TEXT,
  correction_type TEXT NOT NULL,
  corrected_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  short_name TEXT,
  website TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  material_id UUID NOT NULL REFERENCES materials_dictionary(id),
  supplier_name TEXT NOT NULL,
  supplier_sku TEXT,
  document_type TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_id, supplier_name)
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

INSERT INTO suppliers (name, short_name) VALUES
  ('МеталлБаза 24', 'МБ24'),
  ('Металл-Трейд', 'МТ'),
  ('СтальМет', 'СМ')
ON CONFLICT (name) DO NOTHING;

INSERT INTO materials_dictionary (normalized_name, aliases, material_group, unit, gost, steel_grade, dimensions)
VALUES
  ('Труба профильная 80x80x4', ARRAY['тр 80х80х4','проф труба 80 80 4','80x80x4 st3'], 'Труба профильная', 'м', 'ГОСТ 30245-2003', 'S235', '{"a":80,"b":80,"t":4}'),
  ('Лист 4x1500x6000', ARRAY['л 4х1500х6000','лист 4мм','sheet 4mm'], 'Лист', 'кг', 'ГОСТ 19903-2015', 'Ст3сп', '{"t":4,"w":1500,"l":6000}'),
  ('Уголок 63x63x5', ARRAY['уг 63х63х5','угол 63х5','L63x63x5'], 'Уголок', 'м', 'ГОСТ 8509-93', 'Ст3пс', '{"a":63,"b":63,"t":5}')
ON CONFLICT (normalized_name) DO NOTHING;
