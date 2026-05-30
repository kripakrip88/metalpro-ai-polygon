import { Injectable, Logger } from "@nestjs/common";
import { AssemblyExtractionPromptBuilderService } from "./assembly-extraction-prompt-builder.service";
import { ExtractionTelemetryService } from "./extraction-telemetry.service";
import { safeParseAssemblyResponse } from "../schemas/assembly-extraction.schema";
import { ExtractedAssembly, ExtractedAssemblyRepository } from "../repositories/extracted-assembly.repository";

const CLAUDE_MODEL   = "claude-sonnet-4-20250514";
const CLAUDE_API_URL = `${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`;

@Injectable()
export class AssemblyExtractorService {
  private readonly logger = new Logger(AssemblyExtractorService.name);

  constructor(
    private readonly promptBuilder: AssemblyExtractionPromptBuilderService,
    private readonly assemblyRepo: ExtractedAssemblyRepository,
    private readonly telemetry: ExtractionTelemetryService,
  ) {}

  async extract(documentId: string, cleanedOcrText: string): Promise<ExtractedAssembly[]> {
    this.logger.log(`Assembly extraction start: ${documentId}`);

    const built = this.promptBuilder.build({ cleanedOcrText, documentId });

    this.telemetry.apiCallStarted({
      extractionRunId: `assembly-${documentId}`,
      documentId,
      modelProvider: "claude",
      modelVersion: CLAUDE_MODEL,
      charsSent: built.charsSent,
      wasTruncated: built.wasTruncated,
    });

    const apiResult = await this.callClaudeApi(built.systemPrompt, built.userPrompt, built.promptSnapshot);

    if (!apiResult.success) {
      this.logger.error(`Assembly extraction API failed for ${documentId}: ${apiResult.error}`);
      this.telemetry.apiCallFailed({
        extractionRunId: `assembly-${documentId}`,
        documentId,
        modelProvider: "claude",
        errorType: "api_error",
        error: apiResult.error,
        durationMs: 0,
      });
      return [];
    }

    const parseResult = safeParseAssemblyResponse(apiResult.rawResponse);
    if (!parseResult.success) {
      this.logger.error(`Assembly parse failed for ${documentId}: ${parseResult.error}`);
      this.telemetry.parseFailed({
        extractionRunId: `assembly-${documentId}`,
        documentId,
        modelProvider: "claude",
        error: parseResult.error,
        rawLength: apiResult.rawResponse.length,
      });
      return [];
    }

    const { assemblies } = parseResult.data;
    if (assemblies.length === 0) {
      this.logger.warn(`No assemblies found in document ${documentId}`);
      return [];
    }

    const saved = await this.assemblyRepo.createMany(
      assemblies.map(a => ({
        documentId,
        name: a.name,
        designation: a.designation,
        quantity: a.quantity,
        unit: a.unit,
        massKg: a.mass_kg,
        sourceHint: a.source_hint,
        sourceReference: a.source_reference,
        confidence: a.confidence,
        rawText: a.raw_text,
      })),
    );

    this.logger.log(`Assembly extraction complete: ${documentId} | ${saved.length} assemblies | ${apiResult.durationMs}ms`);
    return saved;
  }

  // Stateless variant — no DB write, used for erp-metal direct text calls
  async extractFromText(text: string) {
    const built = this.promptBuilder.build({ cleanedOcrText: text, documentId: "stateless" });
    const apiResult = await this.callClaudeApi(built.systemPrompt, built.userPrompt, built.promptSnapshot);

    if (!apiResult.success) {
      this.logger.error(`Stateless assembly extraction failed: ${apiResult.error}`);
      return [];
    }
    const parseResult = safeParseAssemblyResponse(apiResult.rawResponse);
    if (!parseResult.success) {
      this.logger.error(`Stateless assembly parse failed: ${parseResult.error}`);
      return [];
    }
    return parseResult.data.assemblies.map(a => ({
      name: a.name,
      designation: a.designation ?? undefined,
      quantity: a.quantity,
      unit: a.unit,
      confidence: a.confidence ?? undefined,
      rawText: a.raw_text,
    }));
  }

  private async callClaudeApi(systemPrompt: string, userPrompt: string, _snapshot: Record<string, unknown>): Promise<any> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { success: false, error: "ANTHROPIC_API_KEY not configured" };

    const startedAt = Date.now();
    try {
      const response = await fetch(CLAUDE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 2048,
          temperature: 0,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
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
