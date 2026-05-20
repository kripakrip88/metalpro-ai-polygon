import { Injectable, Logger, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const LOCK_TIMEOUT_MS = 10 * 60 * 1000;

@Injectable()
export class ProcessingLockService {
  private readonly logger = new Logger(ProcessingLockService.name);

  constructor(private readonly prisma: PrismaService) {}

  async acquire(documentId: string, owner: string): Promise<void> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { processingLockedAt: true, processingLockOwner: true },
    });

    if (doc?.processingLockedAt) {
      const ageMs = Date.now() - doc.processingLockedAt.getTime();
      if (ageMs < LOCK_TIMEOUT_MS) {
        throw new ConflictException(`Document ${documentId} is locked by ${doc.processingLockOwner}`);
      }
      this.logger.warn(`Stale lock detected for ${documentId} (${Math.round(ageMs / 1000)}s old) — overriding`);
    }

    await this.prisma.document.update({
      where: { id: documentId },
      data: { processingLockedAt: new Date(), processingLockOwner: owner },
    });

    this.logger.debug(`Lock acquired: ${documentId} by ${owner}`);
  }

  async release(documentId: string): Promise<void> {
    await this.prisma.document.update({
      where: { id: documentId },
      data: { processingLockedAt: null, processingLockOwner: null },
    }).catch(err => this.logger.warn(`Lock release failed for ${documentId}: ${err.message}`));

    this.logger.debug(`Lock released: ${documentId}`);
  }

  async isLocked(documentId: string): Promise<boolean> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { processingLockedAt: true },
    });

    if (!doc?.processingLockedAt) return false;
    return (Date.now() - doc.processingLockedAt.getTime()) < LOCK_TIMEOUT_MS;
  }
}
