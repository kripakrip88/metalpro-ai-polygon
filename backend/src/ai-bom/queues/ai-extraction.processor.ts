import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { QUEUE_NAMES, JOB_NAMES } from "./queue-names.constant";
import { ExtractionOrchestratorService } from "../services/extraction-orchestrator.service";
import { DocumentRepository } from "../repositories/document.repository";
import { ExtractionRunRepository } from "../repositories/extraction-run.repository";
import { ExtractionItemRepository } from "../repositories/extraction-item.repository";
import { UnparsedFragmentRepository } from "../repositories/unparsed-fragment.repository";
import { MaterialsDictionaryRepository } from "../repositories/materials-dictionary.repository";

export interface AiExtractionJobData {
  documentId: string;
  cleanedOcrText: string;
}

@Processor(QUEUE_NAMES.AI_EXTRACTION)
export class AiExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(AiExtractionProcessor.name);

  constructor(
    private readonly orchestrator: ExtractionOrchestratorService,
    private readonly documentRepo: DocumentRepository,
    private readonly runRepo: ExtractionRunRepository,
    private readonly itemRepo: ExtractionItemRepository,
    private readonly fragmentRepo: UnparsedFragmentRepository,
    private readonly materialsRepo: MaterialsDictionaryRepository,
  ) {
    super();
  }

  async process(job: Job<AiExtractionJobData>): Promise<void> {
    if (job.name !== JOB_NAMES.RUN_EXTRACTION) return;

    const { documentId, cleanedOcrText } = job.data;
    this.logger.log(`AI extraction job started: ${documentId}`);

    const repos = {
      documentRepo: this.documentRepo,
      runRepo: this.runRepo,
      itemRepo: this.itemRepo,
      fragmentRepo: this.fragmentRepo,
      materialsRepo: this.materialsRepo,
    };

    try {
      await this.orchestrator.runParallel(documentId, cleanedOcrText, repos);
      this.logger.log(`AI extraction job complete: ${documentId}`);
    } catch (err) {
      this.logger.error(`AI extraction job failed: ${documentId} — ${(err as Error).message}`);
      throw err;
    }
  }
}
