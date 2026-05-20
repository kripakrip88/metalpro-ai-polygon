import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from "prom-client";
import { QUEUE_NAMES } from "../ai-bom/queues/queue-names.constant";

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  readonly httpRequestsTotal: Counter;
  readonly httpRequestDurationSeconds: Histogram;
  readonly documentsProcessedTotal: Counter;
  private readonly queueJobsWaiting: Gauge;
  private readonly queueJobsActive: Gauge;
  private readonly queueJobsFailed: Gauge;

  constructor(
    @InjectQueue(QUEUE_NAMES.OCR_PROCESSING) private readonly ocrQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AI_EXTRACTION) private readonly aiQueue: Queue,
  ) {
    collectDefaultMetrics({ register: this.registry });

    this.httpRequestsTotal = new Counter({
      name: "http_requests_total",
      help: "Total HTTP requests",
      labelNames: ["method", "path", "status"],
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: "http_request_duration_seconds",
      help: "HTTP request duration in seconds",
      labelNames: ["method", "path"],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.documentsProcessedTotal = new Counter({
      name: "documents_processed_total",
      help: "Total documents processed by status",
      labelNames: ["status"],
      registers: [this.registry],
    });

    this.queueJobsWaiting = new Gauge({
      name: "queue_jobs_waiting",
      help: "Number of waiting jobs per queue",
      labelNames: ["queue"],
      registers: [this.registry],
    });

    this.queueJobsActive = new Gauge({
      name: "queue_jobs_active",
      help: "Number of active jobs per queue",
      labelNames: ["queue"],
      registers: [this.registry],
    });

    this.queueJobsFailed = new Gauge({
      name: "queue_jobs_failed",
      help: "Number of failed jobs per queue",
      labelNames: ["queue"],
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    await this.refreshQueueMetrics();
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  recordHttpRequest(method: string, path: string, status: number, durationSeconds: number) {
    this.httpRequestsTotal.inc({ method, path, status: String(status) });
    this.httpRequestDurationSeconds.observe({ method, path }, durationSeconds);
  }

  incrementDocumentProcessed(status: string) {
    this.documentsProcessedTotal.inc({ status });
  }

  private async refreshQueueMetrics() {
    const queues = [
      { q: this.ocrQueue, name: QUEUE_NAMES.OCR_PROCESSING },
      { q: this.aiQueue, name: QUEUE_NAMES.AI_EXTRACTION },
    ];
    for (const { q, name } of queues) {
      try {
        const [waiting, active, failed] = await Promise.all([
          q.getWaitingCount(),
          q.getActiveCount(),
          q.getFailedCount(),
        ]);
        this.queueJobsWaiting.set({ queue: name }, waiting);
        this.queueJobsActive.set({ queue: name }, active);
        this.queueJobsFailed.set({ queue: name }, failed);
      } catch {
        // Redis unavailable — skip queue metrics
      }
    }
  }
}
