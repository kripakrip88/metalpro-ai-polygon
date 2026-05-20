import { Injectable, ConflictException, NotFoundException, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { DocumentRepository } from "../repositories/document.repository";
import { ExtractionResultRepository } from "../repositories/extraction-result.repository";
import { CorrectionsRepository } from "../repositories/corrections.repository";
import { StorageService } from "./storage.service";
import { OcrPreprocessingService } from "./ocr-preprocessing.service";
import { ProcessingLockService } from "./processing-lock.service";
import { ConfirmBomDto } from "../dto/confirm-bom.dto";
import { AiDocumentStatus } from "../types/ai-document-status.enum";
import { PrismaService } from "../../prisma/prisma.service";
import { QUEUE_NAMES, JOB_NAMES } from "../queues/queue-names.constant";
import { OcrCallbackPayload } from "./n8n-orchestrator.service";
import { OcrJobData } from "../queues/ocr.processor";
import { AiExtractionJobData } from "../queues/ai-extraction.processor";

const MAX_RETRY_COUNT = 3;
const OCR_TERMINAL_STATUSES = new Set([
  AiDocumentStatus.OCR_DONE, AiDocumentStatus.AI_PROCESSING,
  AiDocumentStatus.AI_DONE, AiDocumentStatus.NORMALIZED, AiDocumentStatus.CONFIRMED,
]);

@Injectable()
export class AiBomService {
  private readonly logger = new Logger(AiBomService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documentRepo: DocumentRepository,
    private readonly extractionRepo: ExtractionResultRepository,
    private readonly correctionsRepo: CorrectionsRepository,
    private readonly storageService: StorageService,
    private readonly ocrPreprocessing: OcrPreprocessingService,
    private readonly lockService: ProcessingLockService,
    @InjectQueue(QUEUE_NAMES.OCR_PROCESSING) private readonly ocrQueue: Queue<OcrJobData>,
    @InjectQueue(QUEUE_NAMES.AI_EXTRACTION)  private readonly aiQueue: Queue<AiExtractionJobData>,
  ) {}

  async uploadDocument(file: Express.Multer.File) {
    this.storageService.validate(file);
    const stored = this.storageService.resolveStoredFile(file);
    const existing = await this.documentRepo.findByChecksum(stored.sha256Checksum).catch(() => null);
    if (existing) {
      return { documentId: existing.id, status: existing.status, duplicate: true, message: "File already uploaded." };
    }
    const document = await this.documentRepo.create({ ...stored, status: AiDocumentStatus.UPLOADED });
    this.logger.log(`Document saved: ${document.id}`);
    await this.enqueueOcr(document);
    return { documentId: document.id, status: AiDocumentStatus.OCR_PROCESSING, duplicate: false, message: "Uploaded. OCR processing queued." };
  }

  async reprocessOcr(documentId: string, _requestedBy?: string) {
    const document = await this.documentRepo.findById(documentId);
    if (!document) throw new NotFoundException(`Document ${documentId} not found`);
    if (await this.lockService.isLocked(documentId)) throw new ConflictException("Document is currently being processed");
    await this.documentRepo.resetForReprocess(documentId);
    await this.enqueueOcr(document);
    return { documentId, status: AiDocumentStatus.OCR_PROCESSING, message: "OCR reprocessing queued." };
  }

  async handleOcrCallback(payload: OcrCallbackPayload) {
    const document = await this.documentRepo.findById(payload.documentId);
    if (!document) throw new NotFoundException(`Document ${payload.documentId} not found`);

    if (OCR_TERMINAL_STATUSES.has(document.status as AiDocumentStatus)) {
      this.logger.warn(`Duplicate OCR callback ignored: ${payload.documentId} (status: ${document.status})`);
      return { success: true, skipped: true };
    }

    if (!payload.success) {
      await this.lockService.release(payload.documentId);
      const retryCount = (document.retryCount ?? 0) + 1;
      if (retryCount >= MAX_RETRY_COUNT) {
        await this.documentRepo.markFailed(payload.documentId, payload.error ?? "OCR failed after max retries");
      } else {
        await this.documentRepo.incrementRetry(payload.documentId);
        await this.enqueueOcr(document);
      }
      return { success: false };
    }

    const { rawOcrText, cleanedOcrText, ocrPreprocessingVersion } = this.ocrPreprocessing.process(payload.rawOcrText ?? "");
    const ocrMetadata = { engine: payload.ocrEngine, confidence: payload.ocrConfidence, pages: payload.ocrPageCount, duration_ms: payload.ocrDurationMs, language: payload.ocrLanguage ?? "ru" };

    await this.documentRepo.saveOcrResult(payload.documentId, { rawOcrText, cleanedOcrText, ocrMetadata, ocrPreprocessingVersion });
    await this.lockService.release(payload.documentId);

    this.logger.log(`OCR complete: ${payload.documentId} — queuing AI extraction`);

    await this.aiQueue.add(JOB_NAMES.RUN_EXTRACTION, { documentId: payload.documentId, cleanedOcrText }, {
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    });

    return { success: true, skipped: false };
  }

  async getDocument(id: string) {
    const document = await this.documentRepo.findById(id);
    if (!document) throw new NotFoundException(`Document ${id} not found`);
    const extractionResults = await this.extractionRepo.findByDocumentId(id).catch(() => []);
    return { document, extractionResults };
  }

  async listDocuments() { return this.documentRepo.findAll(); }

  async confirmBom(documentId: string, dto: ConfirmBomDto) {
    const document = await this.documentRepo.findById(documentId);
    if (!document) throw new NotFoundException(`Document ${documentId} not found`);

    const results = await Promise.all(
      dto.items.map(item => this.extractionRepo.findById(item.extractionResultId).catch(() => null))
    );

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < dto.items.length; i++) {
        const item = dto.items[i];
        const result = results[i];
        if (!result || result.documentId !== documentId) continue;

        const hasCorrection = item.correctedName !== result.normalizedName
          || item.correctedQty !== result.quantity
          || item.correctedUnit !== result.unit;

        if (hasCorrection || item.rejected) {
          await tx.correction.create({
            data: {
              documentId,
              extractionResultId: item.extractionResultId,
              aiRawText: result.rawText,
              aiSuggestedName: result.normalizedName,
              aiSuggestedQty: result.quantity,
              aiSuggestedUnit: result.unit,
              aiSource: result.source,
              correctedName: item.correctedName,
              correctedQty: item.correctedQty,
              correctedUnit: item.correctedUnit,
              correctionType: item.rejected ? "rejection" : "correction",
              correctedBy: dto.confirmedBy,
            },
          });
        }

        await tx.extractionResult.update({
          where: { id: item.extractionResultId },
          data: {
            status: item.rejected ? "rejected" : "confirmed",
            userCorrectedName: item.correctedName,
            userCorrectedQty: item.correctedQty,
            userCorrectedUnit: item.correctedUnit,
            userNotes: item.notes,
            confirmedBy: dto.confirmedBy,
            confirmedAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      await tx.document.update({
        where: { id: documentId },
        data: { status: AiDocumentStatus.CONFIRMED, confirmedBy: dto.confirmedBy, confirmedAt: new Date() },
      });
    });

    this.logger.log(`BOM confirmed: ${documentId}`);
    return { success: true, documentId };
  }

  private async enqueueOcr(document: any): Promise<void> {
    await this.documentRepo.updateStatus(document.id, AiDocumentStatus.OCR_PROCESSING);
    await this.ocrQueue.add(JOB_NAMES.TRIGGER_OCR, {
      documentId: document.id,
      storagePath: document.storagePath,
      originalFilename: document.originalFilename,
    }, {
      attempts: 3,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: 50,
      removeOnFail: 100,
    });
    this.logger.log(`OCR job queued: ${document.id}`);
  }
}
