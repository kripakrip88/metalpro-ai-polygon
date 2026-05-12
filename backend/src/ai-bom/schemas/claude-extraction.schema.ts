import { z } from "zod";

export const EXTRACTION_SCHEMA_VERSION = "v1.0";

const FieldWithConfidence = (valueSchema) =>
  z.object({
    value:      valueSchema.optional(),
    confidence: z.number().min(0).max(1).optional(),
  });

export const ExtractionItemSchema = z.object({
  raw_text:        FieldWithConfidence(z.string()),
  quantity:        FieldWithConfidence(z.number().positive()),
  unit:            FieldWithConfidence(z.string()),
  material_type:   FieldWithConfidence(z.string()),
  page_number:     z.number().int().positive().optional(),
  line_number:     z.number().int().positive().optional(),
  item_confidence: z.number().min(0).max(1).optional(),
});

export const UnparsedFragmentSchema = z.object({
  raw_text:    z.string().min(1),
  reason:      z.string().optional(),
  page_number: z.number().int().positive().optional(),
  line_number: z.number().int().positive().optional(),
});

export const ClaudeExtractionResponseSchema = z.object({
  project_name:        z.string().optional(),
  supplier_name:       z.string().optional(),
  materials:           z.array(ExtractionItemSchema).default([]),
  unparsed_fragments:  z.array(UnparsedFragmentSchema).default([]),
  overall_confidence:  z.number().min(0).max(1).optional(),
  schema_version:      z.string().optional(),
});

export type ClaudeExtractionResponse = z.infer<typeof ClaudeExtractionResponseSchema>;

export function safeParseClaudeResponse(rawResponse) {
  const warnings = [];
  let jsonString = rawResponse.trim();

  const fenceMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) { jsonString = fenceMatch[1].trim(); warnings.push("Stripped markdown fence"); }

  const jsonStart = jsonString.indexOf("{");
  const jsonEnd   = jsonString.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    return { success: false, error: "No JSON object found", rawResponse };
  }
  if (jsonStart > 0 || jsonEnd < jsonString.length - 1) {
    jsonString = jsonString.slice(jsonStart, jsonEnd + 1);
    warnings.push("Extracted JSON from surrounding text");
  }

  let parsed;
  try { parsed = JSON.parse(jsonString); }
  catch (err) { return { success: false, error: `JSON.parse failed: ${err.message}`, rawResponse }; }

  const result = ClaudeExtractionResponseSchema.safeParse(parsed);
  if (!result.success) {
    return { success: false, error: `Schema validation failed: ${result.error.message}`, rawResponse };
  }
  return { success: true, data: result.data, parseWarnings: warnings };
}
