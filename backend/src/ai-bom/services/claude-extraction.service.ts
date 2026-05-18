import { Injectable, Logger } from "@nestjs/common";
import { ClaudePromptBuilderService } from "./claude-prompt-builder.service";
import { ExtractionTelemetryService } from "./extraction-telemetry.service";
import { safeParseClaudeResponse, EXTRACTION_SCHEMA_VERSION } from "../schemas/claude-extraction.schema";

const CLAUDE_MODEL   = "claude-sonnet-4-20250514";
const CLAUDE_API_URL = `${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`;

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
      documentId, modelProvider: "claude", modelVersion: CLAUDE_MODEL,
      extractionSchemaVersion: EXTRACTION_SCHEMA_VERSION,
      promptSnapshot: built.promptSnapshot, status: "processing", startedAt: new Date(),
    });

    this.telemetry.apiCallStarted({ extractionRunId: run.id, documentId, modelProvider: "claude", modelVersion: CLAUDE_MODEL, charsSent: built.charsSent, wasTruncated: built.wasTruncated });

    const apiResult = await this.callClaudeApi(built.systemPrompt, built.userPrompt);

    if (!apiResult.success) {
      await repos.runRepo.markFailed(run.id, apiResult.error);
      this.telemetry.apiCallFailed({ extractionRunId: run.id, documentId, modelProvider: "claude", errorType: "api_error", error: apiResult.error, durationMs: 0 });
      return { extractionRunId: run.id, status: "failed", itemCount: 0, fragmentCount: 0 };
    }

    const parseResult = safeParseClaudeResponse(apiResult.rawResponse);

    if (!parseResult.success) {
      await repos.runRepo.saveRawResponse(run.id, { rawResponse: apiResult.rawResponse, parsedJson: null, tokensInput: apiResult.tokensInput, tokensOutput: apiResult.tokensOutput, durationMs: apiResult.durationMs, status: "failed", errorMessage: parseResult.error });
      this.telemetry.parseFailed({ extractionRunId: run.id, documentId, modelProvider: "claude", error: parseResult.error, rawLength: apiResult.rawResponse.length });
      return { extractionRunId: run.id, status: "failed", itemCount: 0, fragmentCount: 0 };
    }

    const data = parseResult.data;
    await repos.runRepo.saveRawResponse(run.id, { rawResponse: apiResult.rawResponse, parsedJson: data, tokensInput: apiResult.tokensInput, tokensOutput: apiResult.tokensOutput, durationMs: apiResult.durationMs, status: "completed", errorMessage: null });

    const items = data.materials.map((m: any) => ({ extractionRunId: run.id, documentId, rawText: m.raw_text?.value ?? "", fieldsWithConfidence: m, itemConfidence: m.item_confidence, pageNumber: m.page_number, lineNumber: m.line_number }));
    if (items.length > 0) { await repos.itemRepo.createMany(items); this.telemetry.itemsSaved({ extractionRunId: run.id, documentId, modelProvider: "claude", count: items.length }); }

    const fragments = (data.unparsed_fragments ?? []).map((f: any) => ({ extractionRunId: run.id, documentId, rawText: f.raw_text, reason: f.reason, pageNumber: f.page_number, lineNumber: f.line_number }));
    if (fragments.length > 0) { await repos.fragmentRepo.createMany(fragments); this.telemetry.fragmentsSaved({ extractionRunId: run.id, documentId, modelProvider: "claude", count: fragments.length }); }

    this.logger.log(`Claude complete: ${run.id} | ${items.length} items | ${fragments.length} frags | ${apiResult.durationMs}ms`);
    return { extractionRunId: run.id, status: "completed", itemCount: items.length, fragmentCount: fragments.length };
  }

  private async callClaudeApi(systemPrompt: string, userPrompt: string): Promise<any> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { success: false, error: "ANTHROPIC_API_KEY not configured" };
    const startedAt = Date.now();
    try {
      const response = await fetch(CLAUDE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 4096, temperature: 0, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] }),
      });
      const durationMs = Date.now() - startedAt;
      if (!response.ok) return { success: false, error: `Claude API HTTP ${response.status}` };
      const body = await response.json() as any;
      const textBlock = body.content?.find((c: any) => c.type === "text");
      if (!textBlock?.text) return { success: false, error: "No text in Claude response" };
      return { success: true, rawResponse: textBlock.text, tokensInput: body.usage?.input_tokens ?? 0, tokensOutput: body.usage?.output_tokens ?? 0, durationMs };
    } catch (err) {
      return { success: false, error: `Network error: ${(err as Error).message}` };
    }
  }
}
