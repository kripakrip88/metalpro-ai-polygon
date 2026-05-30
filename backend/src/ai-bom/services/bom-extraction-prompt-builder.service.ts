import { Injectable, Logger } from "@nestjs/common";
import { BOM_EXTRACTION_SCHEMA_VERSION } from "../schemas/bom-extraction.schema";

const MAX_OCR_CHARS = 12000;

export interface BuiltBomPrompt {
  systemPrompt: string;
  userPrompt: string;
  promptSnapshot: Record<string, unknown>;
  wasTruncated: boolean;
  charsSent: number;
}

export interface AssemblyContext {
  name: string;
  designation?: string;
}

@Injectable()
export class BomExtractionPromptBuilderService {
  private readonly logger = new Logger(BomExtractionPromptBuilderService.name);

  build(input: { cleanedOcrText: string; assembly: AssemblyContext; documentId: string }): BuiltBomPrompt {
    let ocrText = input.cleanedOcrText;
    const wasTruncated = ocrText.length > MAX_OCR_CHARS;
    if (wasTruncated) {
      ocrText = ocrText.slice(0, MAX_OCR_CHARS);
      this.logger.warn(`OCR truncated for ${input.documentId}: ${input.cleanedOcrText.length} -> ${MAX_OCR_CHARS}`);
    }

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(ocrText, input.assembly);
    const promptSnapshot = {
      schema_version: BOM_EXTRACTION_SCHEMA_VERSION,
      stage: "bom_extraction",
      assembly: input.assembly,
      system: systemPrompt,
      user: userPrompt,
      context: { ocr_chars_sent: ocrText.length, ocr_was_truncated: wasTruncated },
      parameters: { max_tokens: 4096, temperature: 0 },
    };

    return { systemPrompt, userPrompt, promptSnapshot, wasTruncated, charsSent: ocrText.length };
  }

  private buildSystemPrompt(): string {
    return `You are a metal fabrication BOM extractor. Extract the bill of materials (спецификацию) for the specified assembly.

Rules:
- Extract each line item: position number, profile name, steel grade, GOST standard, dimensions, quantity, unit, mass, coating
- profile_type: "pipe" (труба), "sheet" (лист), "angle" (уголок), "channel" (швеллер), "beam" (балка), "rod" (круг/пруток), "other"
- If a dimension is not stated, omit it. Do not guess.
- coating: only if explicitly stated for this line item (e.g. "ГФ-021, 80 мкм")
- source_hint: "pdf_spec" for PDF drawings/specs, "excel_sheet" for spreadsheets
- If a line cannot be parsed as a BOM item, skip it (do not include junk)

Return valid JSON only, no markdown, no preamble:
{
  "assembly_name":       "Лестница маршевая",
  "assembly_designation": "Л1",
  "source_hint":         "pdf_spec",
  "source_reference":    "Лист 2",
  "items": [
    {
      "position_number": 1,
      "name":            "Труба профильная 80×80×4",
      "profile_type":    "pipe",
      "steel_grade":     "09Г2С",
      "gost":            "ГОСТ 8639-82",
      "length_mm":       2400,
      "quantity":        6,
      "unit":            "шт.",
      "mass_unit_kg":    14.2,
      "mass_total_kg":   85.2,
      "confidence":      0.97,
      "raw_text":        "1 Тр.пр. 80×80×4 09Г2С ГОСТ8639 L=2400 6шт 85,2кг"
    }
  ],
  "overall_confidence": 0.91,
  "schema_version": "${BOM_EXTRACTION_SCHEMA_VERSION}"
}`;
  }

  private buildUserPrompt(ocrText: string, assembly: AssemblyContext): string {
    const assemblyId = assembly.designation
      ? `"${assembly.name}" (обозначение: ${assembly.designation})`
      : `"${assembly.name}"`;

    return `Extract the bill of materials for assembly ${assemblyId}.

Extract only the components that belong to this assembly.
If the document contains multiple assemblies, extract only the BOM for ${assemblyId}.

DOCUMENT TEXT:
---
${ocrText}
---

Return JSON only.`;
  }
}
