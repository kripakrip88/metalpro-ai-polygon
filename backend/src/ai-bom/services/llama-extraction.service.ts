import { Injectable, Logger } from "@nestjs/common";
import { LlamaInferenceProvider } from "../providers/llama-inference.provider";
import { ClaudePromptBuilderService } from "./claude-prompt-builder.service";
import { ExtractionTelemetryService } from "./extraction-telemetry.service";
import { safeParseClaudeResponse, EXTRACTION_SCHEMA_VERSION } from "../schemas/claude-extraction.schema";

const LLAMA_MODEL = process.env.LLAMA_MODEL ?? "llama3.2:8b";

@Injectable()
export class LlamaExtractionService {
  private readonly logger = new Logger(LlamaExtractionService.name);

  constructor(
    private readonly llamaProvider: LlamaInferenceProvider,
    private readonly promptBuilder: ClaudePromptBuilderService,
    private readonly telemetry: ExtractionTelemetryService,
  ) {}

  async extract(documentId: string, cleanedOcrText: string, repos: any): Promise<{ extractionRunId: string; status: string; itemCount: number; fragmentCount: number }> {
    this.logger.log(`Llama extraction start: ${documentId}`);
    const allMaterials = await repos.materialsRepo.findAll().catch(() => []);
    const materialsSample = allMaterials.map((m: any) => ({ normalizedName: m.normalizedName, unit: m.unit ?? "", aliases: m.aliases ?? [] }));
    const built = this.promptBuilder.build({ cleanedOcrText, materialsSample, materialsCount: allMaterials.length, documentId });

    const run = await repos.runRepo.create({ documentId, modelProvider: "llama", modelVersion: LLAMA_MODEL, extractionSchemaVersion: EXTRACTION_SCHEMA_VERSION, promptSnapshot: built.promptSnapshot, status: "processing", startedAt: new Date() });
    this.telemetry.apiCallStarted({ extractionRunId: run.id, documentId, modelProvider: "llama", modelVersion: LLAMA_MODEL, charsSent: built.charsSent, wasTruncated: built.wasTruncated });

    const inferResult = await this.llamaProvider.infer({ systemPrompt: built.systemPrompt, userPrompt: built.userPrompt, maxTokens: 4096, temperature: 0 });

    if (!inferResult.success) {
      const failed = inferResult as { success: false; error: string; errorType: string; durationMs: number };
      await repos.runRepo.markFailed(run.id, failed.error);
      this.telemetry.apiCallFailed({ extractionRunId: run.id, documentId, modelProvider: "llama", errorType: failed.errorType, error: failed.error, durationMs: failed.durationMs });
      this.logger.warn(`Llama failed (${failed.errorType}): ${documentId} — document status unchanged`);
      return { extractionRunId: run.id, status: "failed", itemCount: 0, fragmentCount: 0 };
    }

    this.telemetry.apiCallCompleted({ extractionRunId: run.id, documentId, modelProvider: "llama", modelVersion: inferResult.model, tokensInput: inferResult.tokensInput, tokensOutput: inferResult.tokensOutput, durationMs: inferResult.durationMs, memoryUsageMb: inferResult.memoryUsageMb });

    const parseResult = safeParseClaudeResponse(inferResult.rawResponse);
    if (!parseResult.success) {
      await repos.runRepo.saveRawResponse(run.id, { rawResponse: inferResult.rawResponse, parsedJson: null, tokensInput: inferResult.tokensInput, tokensOutput: inferResult.tokensOutput, durationMs: inferResult.durationMs, status: "failed", errorMessage: parseResult.error });
      this.telemetry.parseFailed({ extractionRunId: run.id, documentId, modelProvider: "llama", error: parseResult.error, rawLength: inferResult.rawResponse.length });
      return { extractionRunId: run.id, status: "failed", itemCount: 0, fragmentCount: 0 };
    }

    const data = parseResult.data;
    await repos.runRepo.saveRawResponse(run.id, { rawResponse: inferResult.rawResponse, parsedJson: data, tokensInput: inferResult.tokensInput, tokensOutput: inferResult.tokensOutput, durationMs: inferResult.durationMs, status: "completed", errorMessage: null });

    const items = data.materials.map((m: any) => ({ extractionRunId: run.id, documentId, rawText: m.raw_text?.value ?? "", fieldsWithConfidence: m, itemConfidence: m.item_confidence, pageNumber: m.page_number, lineNumber: m.line_number }));
    if (items.length > 0) { await repos.itemRepo.createMany(items); this.telemetry.itemsSaved({ extractionRunId: run.id, documentId, modelProvider: "llama", count: items.length }); }

    const fragments = (data.unparsed_fragments ?? []).map((f: any) => ({ extractionRunId: run.id, documentId, rawText: f.raw_text, reason: f.reason, pageNumber: f.page_number, lineNumber: f.line_number }));
    if (fragments.length > 0) { await repos.fragmentRepo.createMany(fragments); this.telemetry.fragmentsSaved({ extractionRunId: run.id, documentId, modelProvider: "llama", count: fragments.length }); }

    this.logger.log(`Llama complete: ${run.id} | ${items.length} items | ${fragments.length} frags | ${inferResult.durationMs}ms`);
    return { extractionRunId: run.id, status: "completed", itemCount: items.length, fragmentCount: fragments.length };
  }
}
