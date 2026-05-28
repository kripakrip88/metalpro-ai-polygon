-- Stage 5: Hierarchical Extraction (Assembly → BOM → BOMItem → Material)
-- Additive migration — existing tables are not modified.

-- Coating spec: extracted separately, not mixed with materials
CREATE TABLE IF NOT EXISTS extracted_coating (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id      UUID NOT NULL REFERENCES ai_documents(id),
  name             TEXT NOT NULL,
  thickness_micron INTEGER,
  layers           INTEGER,
  area_m2          NUMERIC(10,4),
  raw_text         TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Top-level assembly (изделие): what needs to be manufactured
CREATE TABLE IF NOT EXISTS extracted_assembly (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id      UUID NOT NULL REFERENCES ai_documents(id),
  name             TEXT NOT NULL,
  designation      TEXT,
  quantity         NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit             TEXT NOT NULL DEFAULT 'шт.',
  mass_kg          NUMERIC(12,4),
  source_hint      TEXT NOT NULL,   -- 'email_body' | 'excel_sheet' | 'pdf_page' | 'filename'
  source_reference TEXT,
  confidence       NUMERIC(5,4),
  raw_text         TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assembly_document ON extracted_assembly(document_id);

-- BOM: specification for one assembly (1:1 per assembly per extraction run)
CREATE TABLE IF NOT EXISTS extracted_bom (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assembly_id        UUID NOT NULL REFERENCES extracted_assembly(id),
  source_document_id UUID NOT NULL REFERENCES ai_documents(id),
  source_hint        TEXT NOT NULL,   -- 'pdf_spec' | 'excel_sheet'
  source_reference   TEXT,
  extraction_run_id  UUID REFERENCES ai_extraction_runs(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bom_assembly ON extracted_bom(assembly_id);

-- BOM item: one line in a specification
CREATE TABLE IF NOT EXISTS extracted_bom_item (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bom_id          UUID NOT NULL REFERENCES extracted_bom(id),
  position_number INTEGER,
  name            TEXT NOT NULL,
  profile_type    TEXT NOT NULL DEFAULT 'other',  -- 'pipe' | 'sheet' | 'angle' | 'channel' | 'beam' | 'rod' | 'other'
  steel_grade     TEXT,
  gost            TEXT,
  length_mm       NUMERIC(10,2),
  thickness_mm    NUMERIC(8,3),
  width_mm        NUMERIC(10,2),
  height_mm       NUMERIC(10,2),
  quantity        NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit            TEXT NOT NULL DEFAULT 'шт.',
  mass_unit_kg    NUMERIC(10,4),
  mass_total_kg   NUMERIC(12,4),
  coating_id      UUID REFERENCES extracted_coating(id),
  confidence      NUMERIC(5,4),
  raw_text        TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bom_item_bom ON extracted_bom_item(bom_id);

-- Normalized material: result of matching bom_item → materials_dictionary
CREATE TABLE IF NOT EXISTS extracted_material (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bom_item_id      UUID NOT NULL REFERENCES extracted_bom_item(id),
  erp_material_id  TEXT,             -- nullable until match found
  matched_name     TEXT NOT NULL,
  match_confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
  match_method     TEXT NOT NULL DEFAULT 'ai_suggested',  -- 'exact' | 'alias' | 'ai_suggested' | 'manual'
  reviewed_by      TEXT,             -- user_id after manual review
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_material_bom_item ON extracted_material(bom_item_id);
CREATE INDEX idx_material_erp_id ON extracted_material(erp_material_id) WHERE erp_material_id IS NOT NULL;
