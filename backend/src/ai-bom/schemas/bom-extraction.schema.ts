import { z } from "zod";

export const BOM_EXTRACTION_SCHEMA_VERSION = "v1.0";

const ProfileType = z.enum(["pipe", "sheet", "angle", "channel", "beam", "rod", "other"]);

export const BomItemSchema = z.object({
  position_number: z.number().int().positive().optional(),
  name:            z.string().min(1),
  profile_type:    ProfileType.default("other"),
  steel_grade:     z.string().optional(),
  gost:            z.string().optional(),
  length_mm:       z.number().positive().optional(),
  thickness_mm:    z.number().positive().optional(),
  width_mm:        z.number().positive().optional(),
  height_mm:       z.number().positive().optional(),
  quantity:        z.number().positive().default(1),
  unit:            z.string().default("шт."),
  mass_unit_kg:    z.number().positive().optional(),
  mass_total_kg:   z.number().positive().optional(),
  coating:         z.object({
    name:             z.string().min(1),
    thickness_micron: z.number().int().positive().optional(),
    layers:           z.number().int().positive().optional(),
  }).optional(),
  confidence:      z.number().min(0).max(1).optional(),
  raw_text:        z.string().min(1),
});

export const BomExtractionResponseSchema = z.object({
  assembly_name:      z.string().optional(),
  assembly_designation: z.string().optional(),
  source_hint:        z.enum(["pdf_spec", "excel_sheet"]).default("pdf_spec"),
  source_reference:   z.string().optional(),
  items:              z.array(BomItemSchema).default([]),
  overall_confidence: z.number().min(0).max(1).optional(),
  schema_version:     z.string().optional(),
});

export type BomExtractionResponse = z.infer<typeof BomExtractionResponseSchema>;
export type BomItem = z.infer<typeof BomItemSchema>;

export function safeParseBomResponse(rawResponse: string) {
  const warnings: string[] = [];
  let jsonString = rawResponse.trim();

  const fenceMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) { jsonString = fenceMatch[1].trim(); warnings.push("Stripped markdown fence"); }

  const jsonStart = jsonString.indexOf("{");
  const jsonEnd   = jsonString.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    return { success: false as const, error: "No JSON object found", rawResponse };
  }
  if (jsonStart > 0 || jsonEnd < jsonString.length - 1) {
    jsonString = jsonString.slice(jsonStart, jsonEnd + 1);
    warnings.push("Extracted JSON from surrounding text");
  }

  let parsed: unknown;
  try { parsed = JSON.parse(jsonString); }
  catch (err: any) {
    return { success: false as const, error: `JSON.parse failed: ${err.message}`, rawResponse };
  }

  const result = BomExtractionResponseSchema.safeParse(parsed);
  if (!result.success) {
    return { success: false as const, error: `Schema validation failed: ${result.error.message}`, rawResponse };
  }
  return { success: true as const, data: result.data, parseWarnings: warnings };
}
