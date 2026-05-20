import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { QUEUE_NAMES, JOB_NAMES } from "./queue-names.constant";
import { N8nOrchestratorService } from "../services/n8n-orchestrator.service";
import { DocumentRepository } from "../repositories/document.repository";
import { AiDocumentStatus } from "../types/ai-document-status.enum";

export interface OcrJobData {
  documentId: string;
  storagePath: string;
  originalFilename: string;
}

@Processor(QUEUE_NAMES.OCR_PROCESSING)
export class OcrProcessor extends WorkerHost {
  private readonly logger = new Logger(OcrProcessor.name);

  constructor(
    private readonly n8nOrchestrator: N8nOrchestratorService,
    private readonly documentRepo: DocumentRepository,
  ) {
    super();
  }

  async process(job: Job<OcrJobData>): Promise<void> {
    if (job.name !== JOB_NAMES.TRIGGER_OCR) return;

    const { documentId, storagePath, originalFilename } = job.data;
    this.logger.log(`OCR job started: ${documentId}`);

    try {
      await this.documentRepo.updateStatus(documentId, AiDocumentStatus.OCR_PROCESSING, {
        ocrStartedAt: new Date(),
        processingLockedAt: new Date(),
        processingLockOwner: "ocr-queue",
      });

      await this.n8nOrchestrator.triggerOcrPipeline({ documentId, storagePath, originalFilename });
      this.logger.log(`OCR trigger sent: ${documentId}`);
    } catch (err) {
      this.logger.error(`OCR job failed: ${documentId} — ${(err as Error).message}`);
      await this.documentRepo.markFailed(documentId, `OCR trigger error: ${(err as Error).message}`).catch(() => null);
      throw err;
    }
  }
}
