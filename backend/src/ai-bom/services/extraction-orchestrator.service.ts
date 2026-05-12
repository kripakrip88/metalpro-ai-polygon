import { Injectable, Logger } from "@nestjs/common";
import { ClaudeExtractionService } from "./claude-extraction.service";
import { LlamaExtractionService } from "./llama-extraction.service";
import { AiDocumentStatus } from "../types/ai-document-status.enum";

@Injectable()
export class ExtractionOrchestratorService {
  private readonly logger = new Logger(ExtractionOrchestratorService.name);

  constructor(
    private readonly claudeExtraction: ClaudeExtractionService,
    private readonly llamaExtraction: LlamaExtractionService,
  ) {}

  async runParallel(documentId: string, cleanedOcrText: string, repos: any): Promise<void> {
    this.logger.log(`Extraction orchestration start: ${documentId}`);
    await repos.documentRepo.updateStatus(documentId, AiDocumentStatus.AI_PROCESSING, { aiStartedAt: new Date() });

    const [claudeSettled, llamaSettled] = await Promise.allSettled([
      this.claudeExtraction.extract(documentId, cleanedOcrText, repos),
      this.llamaExtraction.extract(documentId, cleanedOcrText, repos),
    ]);

    // Claude = primary — determines document status
    if (claudeSettled.status === "rejected") {
      const error = (claudeSettled.reason as Error)?.message ?? "Unknown Claude error";
      this.logger.error(`Claude threw exception for ${documentId}: ${error}`);
      await repos.documentRepo.updateStatus(documentId, AiDocumentStatus.AI_FAILED, { aiFailedAt: new Date(), aiError: error });
    } else {
      const result = claudeSettled.value;
      if (result.status === "completed") {
        await repos.documentRepo.updateStatus(documentId, AiDocumentStatus.AI_DONE, { aiCompletedAt: new Date() });
        this.logger.log(`Claude succeeded: ${documentId} | ${result.itemCount} items`);
      } else {
        await repos.documentRepo.updateStatus(documentId, AiDocumentStatus.AI_FAILED, { aiFailedAt: new Date(), aiError: "Claude extraction failed" });
      }
    }

    // Llama = benchmark — failure never changes document.status
    if (llamaSettled.status === "rejected") {
      const error = (llamaSettled.reason as Error)?.message ?? "Unknown Llama error";
      this.logger.warn(`Llama threw exception for ${documentId}: ${error} — document status unchanged`);
      await repos.documentRepo.updateLlamaStatus(documentId, { llamaFailedAt: new Date(), llamaError: error });
    } else {
      const result = llamaSettled.value;
      if (result.status === "completed") {
        await repos.documentRepo.updateLlamaStatus(documentId, { llamaRunId: result.extractionRunId, llamaCompletedAt: new Date() });
      } else {
        await repos.documentRepo.updateLlamaStatus(documentId, { llamaFailedAt: new Date(), llamaError: "Llama extraction failed" });
      }
    }

    this.logger.log(`Extraction orchestration complete: ${documentId}`);
  }
}
