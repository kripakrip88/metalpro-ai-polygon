import { Injectable, Logger } from "@nestjs/common";
import { ASSEMBLY_EXTRACTION_SCHEMA_VERSION } from "../schemas/assembly-extraction.schema";

const MAX_OCR_CHARS = 12000;

export interface BuiltAssemblyPrompt {
  systemPrompt: string;
  userPrompt: string;
  promptSnapshot: Record<string, unknown>;
  wasTruncated: boolean;
  charsSent: number;
}

@Injectable()
export class AssemblyExtractionPromptBuilderService {
  private readonly logger = new Logger(AssemblyExtractionPromptBuilderService.name);

  build(input: { cleanedOcrText: string; documentId: string }): BuiltAssemblyPrompt {
    let ocrText = input.cleanedOcrText;
    const wasTruncated = ocrText.length > MAX_OCR_CHARS;
    if (wasTruncated) {
      ocrText = ocrText.slice(0, MAX_OCR_CHARS);
      this.logger.warn(`OCR truncated for ${input.documentId}: ${input.cleanedOcrText.length} -> ${MAX_OCR_CHARS}`);
    }

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(ocrText);
    const promptSnapshot = {
      schema_version: ASSEMBLY_EXTRACTION_SCHEMA_VERSION,
      stage: "assembly_extraction",
      system: systemPrompt,
      user: userPrompt,
      context: { ocr_chars_sent: ocrText.length, ocr_was_truncated: wasTruncated },
      parameters: { max_tokens: 2048, temperature: 0 },
    };

    return { systemPrompt, userPrompt, promptSnapshot, wasTruncated, charsSent: ocrText.length };
  }

  private buildSystemPrompt(): string {
    return `You are a manufacturing document parser. Your ONLY task is to identify top-level assemblies (изделия) — things that need to be manufactured.

Rules:
- Extract ONLY assemblies: products, structures, units (e.g. "Лестница Л1", "Рама Р-01", "Опора ОП-2")
- Do NOT extract materials, profiles, pipes, sheets, bolts, or other components
- Do NOT extract coating specs or surface treatment descriptions
- If quantity is not stated, default to 1
- source_hint: "email_body" if from email text, "excel_sheet" if from spreadsheet, "pdf_page" if from PDF, "filename" if inferred from filename

Return valid JSON only, no markdown, no preamble:
{
  "assemblies": [
    {
      "name":             "Лестница маршевая",
      "designation":      "Л1",
      "quantity":         2,
      "unit":             "шт.",
      "mass_kg":          185.4,
      "source_hint":      "email_body",
      "source_reference": "строка 3",
      "confidence":       0.95,
      "raw_text":         "Лестница Л1 — 2 шт."
    }
  ],
  "overall_confidence": 0.93,
  "schema_version": "${ASSEMBLY_EXTRACTION_SCHEMA_VERSION}"
}`;
  }

  private buildUserPrompt(ocrText: string): string {
    return `Find all top-level assemblies in the document below.
Extract only what needs to be manufactured — not individual materials or components.

DOCUMENT TEXT:
---
${ocrText}
---

Return JSON only.`;
  }
}
