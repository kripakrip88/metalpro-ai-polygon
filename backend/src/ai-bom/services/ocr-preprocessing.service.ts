import { Injectable, Logger } from "@nestjs/common";

export const OCR_PREPROCESSING_VERSION = "v1.0";

export interface OcrPreprocessingResult {
  rawOcrText: string;
  cleanedOcrText: string;
  ocrPreprocessingVersion: string;
}

@Injectable()
export class OcrPreprocessingService {
  private readonly logger = new Logger(OcrPreprocessingService.name);

  process(rawText: string): OcrPreprocessingResult {
    const cleaned = this.clean(rawText);
    this.logger.debug(`OCR preprocessing: ${rawText.length} -> ${cleaned.length} chars`);
    return { rawOcrText: rawText, cleanedOcrText: cleaned, ocrPreprocessingVersion: OCR_PREPROCESSING_VERSION };
  }

  private clean(text: string): string {
    let t = text;
    t = t.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    t = t.replace(/[^\u0020-\u007E\u0400-\u04FF\n\t]/g, " ");
    t = t.split("\n").map(line => line.replace(/\s+/g, " ").trim()).join("\n");
    t = t.replace(/(\d)\s*х\s*(\d)/g, "$1x$2");
    t = t.replace(/\|/g, " ");
    t = t.replace(/\n{3,}/g, "\n\n");
    return t.trim();
  }
}
