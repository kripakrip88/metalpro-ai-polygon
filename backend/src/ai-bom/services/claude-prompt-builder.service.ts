import { Injectable, Logger } from "@nestjs/common";

export const EXTRACTION_SCHEMA_VERSION = "v1.0";
const MAX_OCR_CHARS = 12000;
const MATERIALS_SAMPLE_SIZE = 20;

export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
  promptSnapshot: Record<string, unknown>;
  wasTruncated: boolean;
  charsSent: number;
}

@Injectable()
export class ClaudePromptBuilderService {
  private readonly logger = new Logger(ClaudePromptBuilderService.name);

  build(input: { cleanedOcrText: string; materialsSample: Array<{ normalizedName: string; unit: string; aliases: string[] }>; materialsCount: number; documentId: string }): BuiltPrompt {
    let ocrText = input.cleanedOcrText;
    const wasTruncated = ocrText.length > MAX_OCR_CHARS;
    if (wasTruncated) {
      ocrText = ocrText.slice(0, MAX_OCR_CHARS);
      this.logger.warn(`OCR truncated for ${input.documentId}: ${input.cleanedOcrText.length} -> ${MAX_OCR_CHARS}`);
    }
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(ocrText, input.materialsSample, input.materialsCount);
    const promptSnapshot = {
      schema_version: EXTRACTION_SCHEMA_VERSION,
      system: systemPrompt,
      user: userPrompt,
      context: { materials_count: input.materialsCount, ocr_chars_sent: ocrText.length, ocr_was_truncated: wasTruncated },
      parameters: { max_tokens: 4096, temperature: 0 },
    };
    return { systemPrompt, userPrompt, promptSnapshot, wasTruncated, charsSent: ocrText.length };
  }

  private buildSystemPrompt(): string {
    return `You are a metal materials extraction assistant.
Your ONLY job is to extract material information exactly as written in the document.
Do NOT normalize names, do NOT look up IDs, do NOT apply business rules.
If unsure about a field, omit it. If a line cannot be classified, add to unparsed_fragments.

Return valid JSON only, no markdown, no preamble:
{
  "project_name": "string or omit",
  "supplier_name": "string or omit",
  "materials": [
    {
      "raw_text":       { "value": "тр 80х80х4",  "confidence": 0.98 },
      "quantity":       { "value": 24,             "confidence": 0.74 },
      "unit":           { "value": "м",            "confidence": 0.91 },
      "material_type":  { "value": "tube_profile", "confidence": 0.85 },
      "page_number": 1, "line_number": 5, "item_confidence": 0.87
    }
  ],
  "unparsed_fragments": [{ "raw_text": "шв ??? 16у", "reason": "unclear", "page_number": 2 }],
  "overall_confidence": 0.88,
  "schema_version": "${EXTRACTION_SCHEMA_VERSION}"
}`;
  }

  private buildUserPrompt(ocrText: string, materialsSample: any[], materialsCount: number): string {
    const sample = materialsSample.slice(0, MATERIALS_SAMPLE_SIZE)
      .map(m => `  - "${m.aliases[0] ?? m.normalizedName}" (unit: ${m.unit})`).join("\n");
    return `Extract all materials from the document text below.

DOMAIN CONTEXT (${materialsCount} known materials, showing sample):
${sample}

This context is for calibration only. Extract what is IN THE DOCUMENT.

DOCUMENT TEXT:
---
${ocrText}
---

Return JSON only.`;
  }
}
