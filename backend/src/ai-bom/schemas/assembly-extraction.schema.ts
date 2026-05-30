import { z } from "zod";

export const ASSEMBLY_EXTRACTION_SCHEMA_VERSION = "v1.0";

export const AssemblySchema = z.object({
  name:             z.string().min(1),
  designation:      z.string().optional(),
  quantity:         z.number().positive().default(1),
  unit:             z.string().default("шт."),
  mass_kg:          z.number().positive().optional(),
  source_hint:      z.enum(["email_body", "excel_sheet", "pdf_page", "filename"]).default("email_body"),
  source_reference: z.string().optional(),
  confidence:       z.number().min(0).max(1).optional(),
  raw_text:         z.string().min(1),
});

export const AssemblyExtractionResponseSchema = z.object({
  assemblies:         z.array(AssemblySchema).default([]),
  overall_confidence: z.number().min(0).max(1).optional(),
  schema_version:     z.string().optional(),
});

export type AssemblyExtractionResponse = z.infer<typeof AssemblyExtractionResponseSchema>;

export function safeParseAssemblyResponse(rawResponse: string) {
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

  const result = AssemblyExtractionResponseSchema.safeParse(parsed);
  if (!result.success) {
    return { success: false as const, error: `Schema validation failed: ${result.error.message}`, rawResponse };
  }
  return { success: true as const, data: result.data, parseWarnings: warnings };
}
