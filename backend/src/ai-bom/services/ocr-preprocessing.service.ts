import { Injectable, Logger } from "@nestjs/common";

export const OCR_PREPROCESSING_VERSION = "v1.1";

const MAX_OCR_TEXT_CHARS  = 300_000;
const CHUNK_SIZE_CHARS    = 12_000;
const CHUNK_OVERLAP_CHARS = 200;

export interface OcrPreprocessingResult {
  rawOcrText: string;
  cleanedOcrText: string;
  ocrPreprocessingVersion: string;
  wasTruncated: boolean;
  charCount: number;
}

// Patterns that could override AI system instructions
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|prior|all)\s+instructions?/gi,
  /system\s*:\s*(you are|act as|pretend)/gi,
  /<\s*system\s*>/gi,
  /\[\s*INST\s*\]/gi,
  /<<\s*SYS\s*>>/gi,
  /###\s*(instruction|system|prompt)/gi,
  /\/\*.*?\*\//gs,
];

@Injectable()
export class OcrPreprocessingService {
  private readonly logger = new Logger(OcrPreprocessingService.name);

  process(rawText: string): OcrPreprocessingResult {
    let text = rawText;
    let wasTruncated = false;

    if (text.length > MAX_OCR_TEXT_CHARS) {
      text = text.slice(0, MAX_OCR_TEXT_CHARS);
      wasTruncated = true;
      this.logger.warn(`OCR text truncated: ${rawText.length} → ${MAX_OCR_TEXT_CHARS} chars`);
    }

    const cleaned = this.clean(text);
    this.logger.debug(`OCR preprocessing: ${rawText.length} → ${cleaned.length} chars`);

    return {
      rawOcrText: rawText.slice(0, MAX_OCR_TEXT_CHARS),
      cleanedOcrText: cleaned,
      ocrPreprocessingVersion: OCR_PREPROCESSING_VERSION,
      wasTruncated,
      charCount: cleaned.length,
    };
  }

  chunk(cleanedText: string): string[] {
    if (cleanedText.length <= CHUNK_SIZE_CHARS) return [cleanedText];

    const chunks: string[] = [];
    let offset = 0;

    while (offset < cleanedText.length) {
      const end = Math.min(offset + CHUNK_SIZE_CHARS, cleanedText.length);
      // Break at last newline within range to avoid mid-line splits
      let breakAt = end;
      if (end < cleanedText.length) {
        const lastNl = cleanedText.lastIndexOf("\n", end);
        if (lastNl > offset + CHUNK_SIZE_CHARS / 2) breakAt = lastNl + 1;
      }
      chunks.push(cleanedText.slice(offset, breakAt).trim());
      offset = breakAt - CHUNK_OVERLAP_CHARS;
      if (offset < 0) offset = 0;
    }

    return chunks.filter(c => c.length > 0);
  }

  private clean(text: string): string {
    let t = text;

    // Normalise line endings
    t = t.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Strip prompt injection attempts
    for (const pattern of INJECTION_PATTERNS) {
      t = t.replace(pattern, " [REMOVED] ");
    }

    // Strip non-printable chars outside Cyrillic + Latin + common punctuation
    t = t.replace(/[^ -~Ѐ-ӿ\n\t]/g, " ");

    // Normalise dimension separator: "80 х 80" → "80x80"
    t = t.replace(/(\d)\s*х\s*(\d)/g, "$1x$2");

    // Collapse table separators
    t = t.replace(/\|/g, " ");

    // Collapse whitespace within lines, trim each line
    t = t.split("\n").map(line => line.replace(/\s+/g, " ").trim()).join("\n");

    // Collapse excess blank lines
    t = t.replace(/\n{3,}/g, "\n\n");

    return t.trim();
  }
}
