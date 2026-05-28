import { Injectable, Logger } from "@nestjs/common";
import { AssemblyExtractorService } from "./assembly-extractor.service";
import { BomExtractorService } from "./bom-extractor.service";

@Injectable()
export class HierarchicalExtractionOrchestratorService {
  private readonly logger = new Logger(HierarchicalExtractionOrchestratorService.name);

  constructor(
    private readonly assemblyExtractor: AssemblyExtractorService,
    private readonly bomExtractor: BomExtractorService,
  ) {}

  /**
   * Enabled only when ENABLE_HIERARCHICAL_EXTRACTION=true.
   * Run in parallel with the legacy pipeline on staging to validate results
   * before switching production traffic.
   */
  static isEnabled(): boolean {
    return process.env.ENABLE_HIERARCHICAL_EXTRACTION === "true";
  }

  async extract(documentId: string, cleanedOcrText: string): Promise<void> {
    this.logger.log(`Hierarchical extraction start: ${documentId}`);

    const assemblies = await this.assemblyExtractor.extract(documentId, cleanedOcrText);

    if (assemblies.length === 0) {
      this.logger.warn(`Hierarchical extraction: no assemblies found for ${documentId}`);
      return;
    }

    // BOM extraction runs sequentially per assembly to avoid parallel Claude API floods.
    // Each assembly is an independent failure domain.
    for (const assembly of assemblies) {
      try {
        await this.bomExtractor.extractForAssembly(documentId, cleanedOcrText, assembly);
      } catch (err) {
        this.logger.error(`BOM extraction failed for assembly ${assembly.id}: ${(err as Error).message}`);
      }
    }

    this.logger.log(`Hierarchical extraction complete: ${documentId} | ${assemblies.length} assemblies processed`);
  }
}
