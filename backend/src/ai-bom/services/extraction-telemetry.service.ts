import { Injectable, Logger } from "@nestjs/common";

export type TelemetryEventType =
  | "api_call_started" | "api_call_completed" | "api_call_failed"
  | "parse_succeeded"  | "parse_failed"
  | "items_saved"      | "fragments_saved"
  | "model_timeout"    | "model_oom" | "model_not_found" | "truncation_applied";

export interface TelemetryEvent {
  extractionRunId: string;
  documentId: string;
  eventType: TelemetryEventType;
  modelProvider: string;
  modelVersion?: string;
  eventData?: Record<string, unknown>;
}

@Injectable()
export class ExtractionTelemetryService {
  private readonly logger = new Logger(ExtractionTelemetryService.name);

  record(event: TelemetryEvent): void {
    this.persist(event).catch(err =>
      this.logger.error(`Telemetry write failed: ${event.eventType} — ${err.message}`)
    );
  }

  private async persist(event: TelemetryEvent): Promise<void> {
    // TODO: connect TelemetryRepository
    this.logger.debug(`[telemetry] ${event.modelProvider} ${event.eventType} run:${event.extractionRunId}`);
  }

  apiCallStarted(p: { extractionRunId: string; documentId: string; modelProvider: string; modelVersion?: string; charsSent: number; wasTruncated: boolean }): void {
    this.record({ ...p, eventType: "api_call_started", eventData: { chars_sent: p.charsSent, truncated: p.wasTruncated } });
  }

  apiCallCompleted(p: { extractionRunId: string; documentId: string; modelProvider: string; modelVersion?: string; tokensInput: number; tokensOutput: number; durationMs: number; memoryUsageMb?: number | null }): void {
    this.record({ extractionRunId: p.extractionRunId, documentId: p.documentId, modelProvider: p.modelProvider, modelVersion: p.modelVersion, eventType: "api_call_completed", eventData: { tokens_in: p.tokensInput, tokens_out: p.tokensOutput, duration_ms: p.durationMs, memory_mb: p.memoryUsageMb } });
  }

  apiCallFailed(p: { extractionRunId: string; documentId: string; modelProvider: string; errorType: string; error: string; durationMs: number }): void {
    const eventType: TelemetryEventType = p.errorType === "timeout" ? "model_timeout" : p.errorType === "oom" ? "model_oom" : p.errorType === "model_not_found" ? "model_not_found" : "api_call_failed";
    this.record({ extractionRunId: p.extractionRunId, documentId: p.documentId, modelProvider: p.modelProvider, eventType, eventData: { error: p.error, duration_ms: p.durationMs } });
  }

  parseFailed(p: { extractionRunId: string; documentId: string; modelProvider: string; error: string; rawLength: number }): void {
    this.record({ ...p, eventType: "parse_failed", eventData: { error: p.error, raw_length: p.rawLength } });
  }

  itemsSaved(p: { extractionRunId: string; documentId: string; modelProvider: string; count: number }): void {
    this.record({ ...p, eventType: "items_saved", eventData: { count: p.count } });
  }

  fragmentsSaved(p: { extractionRunId: string; documentId: string; modelProvider: string; count: number }): void {
    this.record({ ...p, eventType: "fragments_saved", eventData: { count: p.count } });
  }
}
