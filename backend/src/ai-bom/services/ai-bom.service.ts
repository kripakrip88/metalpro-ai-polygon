import { Injectable, BadRequestException, ConflictException, NotFoundException, Logger } from "@nestjs/common";
import { DocumentRepository } from "../repositories/document.repository";
import { ExtractionResultRepository } from "../repositories/extraction-result.repository";
import { ExtractionRunRepository } from "../repositories/extraction-run.repository";
import { ExtractionItemRepository } from "../repositories/extraction-item.repository";
import { UnparsedFragmentRepository } from "../repositories/unparsed-fragment.repository";
import { MaterialsDictionaryRepository } from "../repositories/materials-dictionary.repository";
import { CorrectionsRepository } from "../repositories/corrections.repository";
import { ExtractedAssemblyRepository } from "../repositories/extracted-assembly.repository";
import { ExtractedBomRepository } from "../repositories/extracted-bom.repository";
import { StorageService } from "./storage.service";
import { N8nOrchestratorService, OcrCallbackPayload } from "./n8n-orchestrator.service";
import { OcrPreprocessingService } from "./ocr-preprocessing.service";
import { ProcessingLockService } from "./processing-lock.service";
import { ExtractionOrchestratorService } from "./extraction-orchestrator.service";
import { HierarchicalExtractionOrchestratorService } from "./hierarchical-extraction-orchestrator.service";
import { ConfirmBomDto } from "../dto/confirm-bom.dto";
import { AiDocumentStatus } from "../types/ai-document-status.enum";

const MAX_RETRY_COUNT = 3;
const OCR_TERMINAL_STATUSES = new Set([
  AiDocumentStatus.OCR_DONE, AiDocumentStatus.AI_PROCESSING,
  AiDocumentStatus.AI_DONE, AiDocumentStatus.NORMALIZED, AiDocumentStatus.CONFIRMED,
]);

@Injectable()
export class AiBomService {
  private readonly logger = new Logger(AiBomService.name);

  constructor(
    private readonly documentRepo: DocumentRepository,
    private readonly extractionRepo: ExtractionResultRepository,
    private readonly correctionsRepo: CorrectionsRepository,
    private readonly storageService: StorageService,
    private readonly n8nOrchestrator: N8nOrchestratorService,
    private readonly ocrPreprocessing: OcrPreprocessingService,
    private readonly lockService: ProcessingLockService,
    private readonly extractionOrchestrator: ExtractionOrchestratorService,
    private readonly hierarchicalOrchestrator: HierarchicalExtractionOrchestratorService,
    private readonly runRepo: ExtractionRunRepository,
    private readonly itemRepo: ExtractionItemRepository,
    private readonly fragmentRepo: UnparsedFragmentRepository,
    private readonly materialsRepo: MaterialsDictionaryRepository,
    private readonly assemblyRepo: ExtractedAssemblyRepository,
    private readonly bomRepo: ExtractedBomRepository,
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
    await this.startOcrProcessing(document);
    return { documentId: document.id, status: AiDocumentStatus.OCR_PROCESSING, duplicate: false, message: "Uploaded. OCR processing async." };
  }

  async reprocessOcr(documentId: string, requestedBy?: string) {
    const document = await this.documentRepo.findById(documentId);
    if (!document) throw new NotFoundException(`Document ${documentId} not found`);
    if (await this.lockService.isLocked(documentId)) throw new ConflictException("Document is currently being processed");
    await this.documentRepo.resetForReprocess(documentId);
    await this.startOcrProcessing(document);
    return { documentId, status: AiDocumentStatus.OCR_PROCESSING, message: "OCR reprocessing started." };
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
        await this.startOcrProcessing(document);
      }
      return { success: false };
    }

    const { rawOcrText, cleanedOcrText, ocrPreprocessingVersion } = this.ocrPreprocessing.process(payload.rawOcrText ?? "");
    const ocrMetadata = { engine: payload.ocrEngine, confidence: payload.ocrConfidence, pages: payload.ocrPageCount, duration_ms: payload.ocrDurationMs, language: payload.ocrLanguage ?? "ru" };

    await this.documentRepo.saveOcrResult(payload.documentId, { rawOcrText, cleanedOcrText, ocrMetadata, ocrPreprocessingVersion, ocrCompletedAt: new Date() });
    await this.lockService.release(payload.documentId);

    this.logger.log(`OCR complete: ${payload.documentId}`);

    // Trigger Claude + Llama in parallel (fire-and-forget)
    const repos = { documentRepo: this.documentRepo, runRepo: this.runRepo, itemRepo: this.itemRepo, fragmentRepo: this.fragmentRepo, materialsRepo: this.materialsRepo };
    this.extractionOrchestrator.runParallel(payload.documentId, cleanedOcrText, repos).catch(err =>
      this.logger.error(`Extraction orchestration failed for ${payload.documentId}: ${err.message}`)
    );

    if (HierarchicalExtractionOrchestratorService.isEnabled()) {
      this.hierarchicalOrchestrator.extract(payload.documentId, cleanedOcrText).catch(err =>
        this.logger.error(`Hierarchical extraction failed for ${payload.documentId}: ${err.message}`)
      );
    }

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
    for (const item of dto.items) {
      const result = await this.extractionRepo.findById(item.extractionResultId).catch(() => null);
      if (!result || result.documentId !== documentId) continue;
      const hasCorrection = item.correctedName !== result.normalizedName || item.correctedQty !== result.quantity || item.correctedUnit !== result.unit;
      if (hasCorrection || item.rejected) {
        await this.correctionsRepo.create({ documentId, extractionResultId: item.extractionResultId, aiRawText: result.rawText, aiSuggestedName: result.normalizedName, aiSuggestedQty: result.quantity, aiSuggestedUnit: result.unit, aiSource: result.source, correctedName: item.correctedName, correctedQty: item.correctedQty, correctedUnit: item.correctedUnit, correctionType: item.rejected ? "rejection" : "correction", correctedBy: dto.confirmedBy });
      }
      await this.extractionRepo.confirm(item.extractionResultId, { status: item.rejected ? "rejected" : "confirmed", userCorrectedName: item.correctedName, userCorrectedQty: item.correctedQty, userCorrectedUnit: item.correctedUnit, userNotes: item.notes, confirmedBy: dto.confirmedBy });
    }
    await this.documentRepo.updateStatus(documentId, AiDocumentStatus.CONFIRMED, { confirmedBy: dto.confirmedBy, confirmedAt: new Date() });
    this.logger.log(`BOM confirmed: ${documentId}`);
    return { success: true, documentId };
  }

  async getBomDraft(documentId: string) {
    const document = await this.documentRepo.findById(documentId);
    if (!document) throw new NotFoundException(`Document ${documentId} not found`);

    const assemblies = await this.assemblyRepo.findByDocumentId(documentId).catch(() => []);

    const result = await Promise.all(
      assemblies.map(async (assembly) => {
        const bom = await this.bomRepo.findByAssemblyId(assembly.id).catch(() => null);
        const items = bom ? await this.bomRepo.findItemsByBomId(bom.id).catch(() => []) : [];
        return {
          id: assembly.id,
          name: assembly.name,
          designation: assembly.designation,
          quantity: assembly.quantity,
          unit: assembly.unit,
          mass_kg: assembly.massKg,
          source_hint: assembly.sourceHint,
          confidence: assembly.confidence,
          bom: bom ? {
            id: bom.id,
            source_hint: bom.sourceHint,
            source_reference: bom.sourceReference,
            items: items.map(item => ({
              id: item.id,
              position: item.positionNumber,
              name: item.name,
              profile_type: item.profileType,
              steel_grade: item.steelGrade,
              gost: item.gost,
              length_mm: item.lengthMm,
              thickness_mm: item.thicknessMm,
              quantity: item.quantity,
              unit: item.unit,
              mass_total_kg: item.massTotalKg,
              confidence: item.confidence,
            })),
          } : null,
        };
      }),
    );

    return { documentId, assemblies: result };
  }

  private async startOcrProcessing(document: any) {
    await this.documentRepo.updateStatus(document.id, AiDocumentStatus.OCR_PROCESSING, { ocrStartedAt: new Date() });
    await this.lockService.acquire(document.id, "ocr-pipeline");
    this.n8nOrchestrator.triggerOcrPipeline({ documentId: document.id, storagePath: document.storagePath, originalFilename: document.originalFilename }).catch(err =>
      this.logger.error(`n8n trigger failed for ${document.id}: ${err.message}`)
    );
  }
}
