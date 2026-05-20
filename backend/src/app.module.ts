import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "./prisma/prisma.module";
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
    BullModule.forRoot({ connection: redisConnection }),
    PrismaModule,
    AiBomModule,
    EmailCopilotModule,
  ],
})
export class AppModule {}
