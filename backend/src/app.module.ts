import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ThrottlerModule } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "nestjs-pino";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { AuditModule } from "./audit/audit.module";
import { HealthModule } from "./health/health.module";
import { MetricsModule } from "./metrics/metrics.module";
import { MaintenanceModule } from "./maintenance/maintenance.module";
import { AiBomModule } from "./ai-bom/ai-bom.module";
import { EmailCopilotModule } from "./email-copilot/email-copilot.module";

function parseRedisUrl(url: string) {
  try {
    const u = new URL(url);
    return { host: u.hostname, port: parseInt(u.port || "6379", 10), password: u.password || undefined };
  } catch {
    return { host: "redis", port: 6379 };
  }
}

const redisConnection = parseRedisUrl(process.env.REDIS_URL ?? "redis://redis:6379");

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? "info",
        transport: process.env.NODE_ENV !== "production"
          ? { target: "pino-pretty", options: { singleLine: true, colorize: true } }
          : undefined,
        redact: ["req.headers.authorization", "req.headers.cookie"],
        autoLogging: {
          ignore: (req) => req.url === "/api/health" || req.url === "/metrics",
        },
      },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: "global", ttl: 60_000, limit: 100 },
    ]),
    BullModule.forRoot({ connection: redisConnection }),
    PrismaModule,
    AuthModule,
    AuditModule,
    HealthModule,
    MetricsModule,
    MaintenanceModule,
    AiBomModule,
    EmailCopilotModule,
  ],
})
export class AppModule {}
