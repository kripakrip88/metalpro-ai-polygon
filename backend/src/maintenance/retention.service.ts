import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";

const MS_90_DAYS = 90 * 24 * 60 * 60 * 1000;
const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron("0 3 * * *", { name: "retention-audit-logs" })
  async cleanAuditLogs() {
    const cutoff = new Date(Date.now() - MS_90_DAYS);
    const { count } = await this.prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    if (count > 0) this.logger.log(`Deleted ${count} audit logs older than 90 days`);
  }

  @Cron("10 3 * * *", { name: "retention-revoked-tokens" })
  async cleanRevokedTokens() {
    const cutoff = new Date(Date.now() - MS_30_DAYS);
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { revokedAt: { not: null }, createdAt: { lt: cutoff } },
    });
    if (count > 0) this.logger.log(`Deleted ${count} revoked refresh tokens older than 30 days`);
  }

  @Cron("20 3 * * 0", { name: "retention-failed-runs" })
  async cleanFailedExtractionRuns() {
    const cutoff = new Date(Date.now() - MS_90_DAYS);
    const { count } = await this.prisma.extractionRun.deleteMany({
      where: { status: "failed", createdAt: { lt: cutoff } },
    });
    if (count > 0) this.logger.log(`Deleted ${count} failed extraction runs older than 90 days`);
  }
}
