-- Stage 5 Step C: store erp-metal assembly context for targeted BOM extraction
ALTER TABLE ai_documents ADD COLUMN IF NOT EXISTS extraction_context JSONB;
