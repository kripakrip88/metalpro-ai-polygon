export const QUEUE_NAMES = {
  OCR_PROCESSING:         "ocr-processing",
  AI_EXTRACTION:          "ai-extraction",
  MATERIAL_NORMALIZATION: "material-normalization",
  NOTIFICATIONS:          "notifications",
} as const;

export const JOB_NAMES = {
  TRIGGER_OCR:     "trigger-ocr",
  RUN_EXTRACTION:  "run-extraction",
} as const;
