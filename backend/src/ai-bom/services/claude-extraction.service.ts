import { Injectable, Logger } from "@nestjs/common";
import { ClaudePromptBuilderService } from "./claude-prompt-builder.service";
import { ExtractionTelemetryService } from "./extraction-telemetry.service";
import { safeParseClaudeResponse, EXTRACTION_SCHEMA_VERSION } from "../schemas/claude-extraction.schema";
import { AI_MODELS, AI_RETRY, CLAUDE_API_URL } from "../config/ai-provider.config";

@Injectable()
export class ClaudeExtractionService {
  private readonly logger = new Logger(ClaudeExtractionService.name);

  constructor(
    private readonly promptBuilder: ClaudePromptBuilderService,
    private readonly telemetry: ExtractionTelemetryService,
  ) {}

  async extract(documentId: string, cleanedOcrText: string, repos: any): Promise<{ extractionRunId: string; status: string; itemCount: number; fragmentCount: number }> {
    this.logger.log(`Claude extraction start: ${documentId}`);

    const allMaterials = await repos.materialsRepo.findAll().catch(() => []);
    const materialsSample = allMaterials.map((m: any) => ({ normalizedName: m.normalizedName, unit: m.unit ?? "", aliases: m.aliases ?? [] }));
    const built = this.promptBuilder.build({ cleanedOcrText, materialsSample, materialsCount: allMaterials.length, documentId });

    const run = await repos.runRepo.create({
      documentId, modelProvider: "claude", modelVersion: AI_MODELS.claude,
      extractionSchemaVersion: EXTRACTION_SCHEMA_VERSION,
      promptSnapshot: built.promptSnapshot, status: "processing", startedAt: new Date(),
    });

    this.telemetry.apiCallStarted({ extractionRunId: run.id, documentId, modelProvider: "claude", modelVersion: AI_MODELS.claude, charsSent: built.charsSent, wasTruncated: built.wasTruncated });

    const apiResult = await this.callClaudeApiWithRetry(built.systemPrompt, built.userPrompt);

    if (!apiResult.success) {
      await repos.runRepo.markFailed(run.id, apiResult.error);
      this.telemetry.apiCallFailed({ extractionRunId: run.id, documentId, modelProvider: "claude", errorType: "api_error", error: apiResult.error, durationMs: apiResult.durationMs ?? 0 });
      return { extractionRunId: run.id, status: "failed", itemCount: 0, fragmentCount: 0 };
    }

    const parseResult = safeParseClaudeResponse(apiResult.rawResponse);

    if (!parseResult.success) {
      await repos.runRepo.saveRawResponse(run.id, apiResult.rawResponse, null);
      this.telemetry.parseFailed({ extractionRunId: run.id, documentId, modelProvider: "claude", error: parseResult.error, rawLength: apiResult.rawResponse.length });
      return { extractionRunId: run.id, status: "failed", itemCount: 0, fragmentCount: 0 };
    }

    const data = parseResult.data;
    await repos.runRepo.saveRawResponse(run.id, apiResult.rawResponse, data);

    this.telemetry.apiCallCompleted({ extractionRunId: run.id, documentId, modelProvider: "claude", modelVersion: AI_MODELS.claude, tokensInput: apiResult.tokensInput, tokensOutput: apiResult.tokensOutput, durationMs: apiResult.durationMs });

    const items = data.materials.map((m: any) => ({ extractionRunId: run.id, documentId, rawText: m.raw_text?.value ?? "", fieldsWithConfidence: m, itemConfidence: m.item_confidence, pageNumber: m.page_number, lineNumber: m.line_number }));
    if (items.length > 0) { await repos.itemRepo.createMany(items); this.telemetry.itemsSaved({ extractionRunId: run.id, documentId, modelProvider: "claude", count: items.length }); }

    const fragments = (data.unparsed_fragments ?? []).map((f: any) => ({ extractionRunId: run.id, documentId, rawText: f.raw_text, reason: f.reason, pageNumber: f.page_number, lineNumber: f.line_number }));
    if (fragments.length > 0) { await repos.fragmentRepo.createMany(fragments); this.telemetry.fragmentsSaved({ extractionRunId: run.id, documentId, modelProvider: "claude", count: fragments.length }); }

    this.logger.log(`Claude complete: ${run.id} | ${items.length} items | ${fragments.length} frags | ${apiResult.durationMs}ms | ${apiResult.attempts} attempt(s)`);
    return { extractionRunId: run.id, status: "completed", itemCount: items.length, fragmentCount: fragments.length };
  }

  private async callClaudeApiWithRetry(systemPrompt: string, userPrompt: string): Promise<any> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { success: false, error: "ANTHROPIC_API_KEY not configured", durationMs: 0 };

    let lastError = "";
    let totalDurationMs = 0;

    for (let attempt = 1; attempt <= AI_RETRY.maxRetries; attempt++) {
      const result = await this.callClaudeApiOnce(apiKey, systemPrompt, userPrompt);
      totalDurationMs += result.durationMs;

      if (result.success) return { ...result, durationMs: totalDurationMs, attempts: attempt };

      lastError = result.error;
      this.logger.warn(`Claude attempt ${attempt}/${AI_RETRY.maxRetries} failed: ${lastError}`);

      if (attempt < AI_RETRY.maxRetries) {
        const delayMs = AI_RETRY.baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return { success: false, error: lastError, durationMs: totalDurationMs };
  }

  private async callClaudeApiOnce(apiKey: string, systemPrompt: string, userPrompt: string): Promise<any> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_RETRY.timeoutMs);

    try {
      const response = await fetch(CLAUDE_API_URL, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: AI_MODELS.claude, max_tokens: 4096, temperature: 0, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] }),
      });
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;

      if (!response.ok) return { success: false, error: `Claude API HTTP ${response.status}`, durationMs };

      const body = await response.json() as any;
      const textBlock = body.content?.find((c: any) => c.type === "text");
      if (!textBlock?.text) return { success: false, error: "No text in Claude response", durationMs };

      return { success: true, rawResponse: textBlock.text, tokensInput: body.usage?.input_tokens ?? 0, tokensOutput: body.usage?.output_tokens ?? 0, durationMs };
    } catch (err) {
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;
      const isTimeout = (err as Error).name === "AbortError";
      return { success: false, error: isTimeout ? "Request timeout" : `Network error: ${(err as Error).message}`, durationMs };
    }
  }
}
