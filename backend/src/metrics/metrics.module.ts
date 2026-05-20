import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { BullModule } from "@nestjs/bullmq";
import { MetricsService } from "./metrics.service";
import { MetricsController } from "./metrics.controller";
import { MetricsInterceptor } from "./metrics.interceptor";
import { QUEUE_NAMES } from "../ai-bom/queues/queue-names.constant";

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.OCR_PROCESSING },
      { name: QUEUE_NAMES.AI_EXTRACTION },
    ),
  ],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
