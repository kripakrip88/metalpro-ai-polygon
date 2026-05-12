import { Injectable, Logger } from "@nestjs/common";

export interface OcrTriggerPayload {
  documentId: string;
  storagePath: string;
  originalFilename: string;
}

export interface OcrCallbackPayload {
  documentId: string;
  success: boolean;
  rawOcrText?: string;
  ocrEngine?: string;
  ocrConfidence?: number;
  ocrPageCount?: number;
  ocrDurationMs?: number;
  ocrLanguage?: string;
  error?: string;
}

@Injectable()
export class N8nOrchestratorService {
  private readonly logger = new Logger(N8nOrchestratorService.name);
  private readonly webhookUrl = process.env.N8N_WEBHOOK_URL;
  private get backendUrl() { return process.env.BACKEND_PUBLIC_URL ?? "http://backend:4000"; }

  async triggerOcrPipeline(payload: OcrTriggerPayload): Promise<void> {
    if (!this.webhookUrl) { this.logger.warn("N8N_WEBHOOK_URL not set — OCR trigger skipped"); return; }
    fetch(`${this.webhookUrl}/ocr-trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, callbackUrl: `${this.backendUrl}/api/ai-bom/internal/ocr-callback` }),
    }).catch(err => this.logger.error(`OCR trigger failed: ${err.message}`));
  }

  async triggerLlamaExtraction(documentId: string): Promise<void> {
    this.logger.debug(`Llama trigger stub — Stage 4 (doc: ${documentId})`);
  }

  validateCallback(payload: unknown): OcrCallbackPayload {
    const p = payload as Record<string, unknown>;
    if (!p.documentId || typeof p.documentId !== "string") throw new Error("Invalid callback: missing documentId");
    if (typeof p.success !== "boolean") throw new Error("Invalid callback: missing success flag");
    return {
      documentId: p.documentId,
      success: p.success as boolean,
      rawOcrText: p.rawOcrText as string | undefined,
      ocrEngine: p.ocrEngine as string | undefined,
      ocrConfidence: p.ocrConfidence as number | undefined,
      ocrPageCount: p.ocrPageCount as number | undefined,
      ocrDurationMs: p.ocrDurationMs as number | undefined,
      ocrLanguage: p.ocrLanguage as string | undefined,
      error: p.error as string | undefined,
    };
  }
}
