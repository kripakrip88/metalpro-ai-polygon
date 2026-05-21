import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditEntry {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  log(entry: AuditEntry): void {
    this.persist(entry).catch(err =>
      this.logger.error(`Audit write failed: ${entry.action}/${entry.entityType} — ${err.message}`)
    );
  }

  private async persist(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId:     entry.userId ?? null,
        action:     entry.action,
        entityType: entry.entityType,
        entityId:   entry.entityId ?? null,
        oldData:    (entry.oldData ?? null) as any,
        newData:    (entry.newData ?? null) as any,
        ipAddress:  entry.ipAddress ?? null,
        userAgent:  entry.userAgent ?? null,
      },
    });
  }
}
