import { Injectable, Logger } from "@nestjs/common";
import { BomExtractionPromptBuilderService } from "./bom-extraction-prompt-builder.service";
import { ExtractionTelemetryService } from "./extraction-telemetry.service";
import { safeParseBomResponse } from "../schemas/bom-extraction.schema";
import { ExtractedAssembly } from "../repositories/extracted-assembly.repository";
import { ExtractedBom, ExtractedBomRepository } from "../repositories/extracted-bom.repository";
import { ExtractedCoatingRepository } from "../repositories/extracted-coating.repository";

const CLAUDE_MODEL   = "claude-sonnet-4-20250514";
const CLAUDE_API_URL = `${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`;

@Injectable()
export class BomExtractorService {
  private readonly logger = new Logger(BomExtractorService.name);

  constructor(
    private readonly promptBuilder: BomExtractionPromptBuilderService,
    private readonly bomRepo: ExtractedBomRepository,
    private readonly coatingRepo: ExtractedCoatingRepository,
    private readonly telemetry: ExtractionTelemetryService,
  ) {}

  async extractForAssembly(documentId: string, cleanedOcrText: string, assembly: ExtractedAssembly): Promise<ExtractedBom | null> {
    this.logger.log(`BOM extraction start: ${documentId} / assembly ${assembly.id}`);

    const built = this.promptBuilder.build({
      cleanedOcrText,
      documentId,
      assembly: { name: assembly.name, designation: assembly.designation },
    });

    this.telemetry.apiCallStarted({
      extractionRunId: `bom-${assembly.id}`,
      documentId,
      modelProvider: "claude",
      modelVersion: CLAUDE_MODEL,
      charsSent: built.charsSent,
      wasTruncated: built.wasTruncated,
    });

    const apiResult = await this.callClaudeApi(built.systemPrompt, built.userPrompt);

    if (!apiResult.success) {
      this.logger.error(`BOM API failed for assembly ${assembly.id}: ${apiResult.error}`);
      this.telemetry.apiCallFailed({
        extractionRunId: `bom-${assembly.id}`,
        documentId,
        modelProvider: "claude",
        errorType: "api_error",
        error: apiResult.error,
        durationMs: 0,
      });
      return null;
    }

    const parseResult = safeParseBomResponse(apiResult.rawResponse);
    if (!parseResult.success) {
      this.logger.error(`BOM parse failed for assembly ${assembly.id}: ${parseResult.error}`);
      this.telemetry.parseFailed({
        extractionRunId: `bom-${assembly.id}`,
        documentId,
        modelProvider: "claude",
        error: parseResult.error,
        rawLength: apiResult.rawResponse.length,
      });
      return null;
    }

    const { items, source_hint, source_reference } = parseResult.data;

    const bom = await this.bomRepo.create({
      assemblyId: assembly.id,
      sourceDocumentId: documentId,
      sourceHint: source_hint,
      sourceReference: source_reference,
    });

    if (items.length === 0) {
      this.logger.warn(`No BOM items found for assembly ${assembly.id}`);
      return bom;
    }

    // Create coatings first, collect their IDs per bom item index
    const coatingIds: (string | undefined)[] = [];
    for (const item of items) {
      if (item.coating) {
        const coating = await this.coatingRepo.create({
          documentId,
          name: item.coating.name,
          thicknessMicron: item.coating.thickness_micron,
          layers: item.coating.layers,
          rawText: item.raw_text,
        });
        coatingIds.push(coating.id);
      } else {
        coatingIds.push(undefined);
      }
    }

    await this.bomRepo.createItems(
      items.map((item, idx) => ({
        bomId: bom.id,
        positionNumber: item.position_number,
        name: item.name,
        profileType: item.profile_type,
        steelGrade: item.steel_grade,
        gost: item.gost,
        lengthMm: item.length_mm,
        thicknessMm: item.thickness_mm,
        widthMm: item.width_mm,
        heightMm: item.height_mm,
        quantity: item.quantity,
        unit: item.unit,
        massUnitKg: item.mass_unit_kg,
        massTotalKg: item.mass_total_kg,
        coatingId: coatingIds[idx],
        confidence: item.confidence,
        rawText: item.raw_text,
      })),
    );

    this.logger.log(`BOM extraction complete: assembly ${assembly.id} | ${items.length} items | ${apiResult.durationMs}ms`);
    return bom;
  }

  private async callClaudeApi(systemPrompt: string, userPrompt: string): Promise<any> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { success: false, error: "ANTHROPIC_API_KEY not configured" };

    const startedAt = Date.now();
    try {
      const response = await fetch(CLAUDE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 4096,
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
