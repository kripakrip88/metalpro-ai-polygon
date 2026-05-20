import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { AuditModule } from "./audit/audit.module";
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
    ThrottlerModule.forRoot([
      { name: "global", ttl: 60_000, limit: 100 },
    ]),
    BullModule.forRoot({ connection: redisConnection }),
    PrismaModule,
    AuthModule,
    AuditModule,
    AiBomModule,
    EmailCopilotModule,
  ],
})
export class AppModule {}
