import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { v4 as uuidv4 } from "uuid";
import { AiBomController } from "./ai-bom.controller";
import { AiBomService } from "./services/ai-bom.service";
import { StorageService } from "./services/storage.service";
import { N8nOrchestratorService } from "./services/n8n-orchestrator.service";
import { OcrPreprocessingService } from "./services/ocr-preprocessing.service";
import { ProcessingLockService } from "./services/processing-lock.service";
import { ClaudePromptBuilderService } from "./services/claude-prompt-builder.service";
import { ClaudeExtractionService } from "./services/claude-extraction.service";
import { LlamaExtractionService } from "./services/llama-extraction.service";
import { ExtractionOrchestratorService } from "./services/extraction-orchestrator.service";
import { ExtractionTelemetryService } from "./services/extraction-telemetry.service";
import { LlamaInferenceProvider } from "./providers/llama-inference.provider";
import { DocumentRepository } from "./repositories/document.repository";
import { ExtractionResultRepository } from "./repositories/extraction-result.repository";
import { ExtractionRunRepository } from "./repositories/extraction-run.repository";
import { ExtractionItemRepository } from "./repositories/extraction-item.repository";
import { UnparsedFragmentRepository } from "./repositories/unparsed-fragment.repository";
import { MaterialsDictionaryRepository } from "./repositories/materials-dictionary.repository";
import { CorrectionsRepository } from "./repositories/corrections.repository";
import { SupplierRepository } from "./repositories/supplier.repository";
import { AssemblyExtractionPromptBuilderService } from "./services/assembly-extraction-prompt-builder.service";
import { BomExtractionPromptBuilderService } from "./services/bom-extraction-prompt-builder.service";
import { AssemblyExtractorService } from "./services/assembly-extractor.service";
import { BomExtractorService } from "./services/bom-extractor.service";
import { HierarchicalExtractionOrchestratorService } from "./services/hierarchical-extraction-orchestrator.service";
import { BomCallbackService } from "./services/bom-callback.service";
import { ExtractedAssemblyRepository } from "./repositories/extracted-assembly.repository";
import { ExtractedBomRepository } from "./repositories/extracted-bom.repository";
import { ExtractedCoatingRepository } from "./repositories/extracted-coating.repository";
import { ExtractedMaterialRepository } from "./repositories/extracted-material.repository";
import { BomExtractionJobRepository } from "./repositories/bom-extraction-job.repository";

const UPLOAD_DEST = process.env.UPLOAD_DIR ?? "./uploads";

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: UPLOAD_DEST,
        filename: (_req, file, cb) => { cb(null, `${uuidv4()}${extname(file.originalname)}`); },
      }),
      limits: { fileSize: 50 * 1024 * 1024, files: 1 },
    }),
  ],
  controllers: [AiBomController],
  providers: [
    AiBomService, ExtractionOrchestratorService,
    StorageService, N8nOrchestratorService, OcrPreprocessingService, ProcessingLockService,
    ClaudePromptBuilderService, ClaudeExtractionService, LlamaExtractionService,
    ExtractionTelemetryService, LlamaInferenceProvider,
    DocumentRepository, ExtractionResultRepository, ExtractionRunRepository,
    ExtractionItemRepository, UnparsedFragmentRepository,
    MaterialsDictionaryRepository, CorrectionsRepository, SupplierRepository,
    // Stage 5 — hierarchical extraction
    AssemblyExtractionPromptBuilderService, BomExtractionPromptBuilderService,
    AssemblyExtractorService, BomExtractorService,
    HierarchicalExtractionOrchestratorService, BomCallbackService,
    ExtractedAssemblyRepository, ExtractedBomRepository,
    ExtractedCoatingRepository, ExtractedMaterialRepository,
    BomExtractionJobRepository,
  ],
  exports: [AiBomService],
})
export class AiBomModule {}
