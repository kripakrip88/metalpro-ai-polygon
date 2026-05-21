import { Injectable, Logger, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const LOCK_TIMEOUT_MS = 10 * 60 * 1000;

@Injectable()
export class ProcessingLockService {
  private readonly logger = new Logger(ProcessingLockService.name);

  constructor(private readonly prisma: PrismaService) {}

  async acquire(documentId: string, owner: string): Promise<void> {
    const existing = await this.prisma.processingLock.findUnique({ where: { documentId } });
    if (existing) {
      const staleCutoff = new Date(Date.now() - LOCK_TIMEOUT_MS);
      if (existing.lockedAt > staleCutoff) {
        throw new ConflictException(`Document ${documentId} is already being processed by ${existing.owner}`);
      }
      this.logger.warn(`Overriding stale lock on ${documentId} (was held by ${existing.owner})`);
    }
    await this.prisma.processingLock.upsert({
      where: { documentId },
      create: { documentId, owner, lockedAt: new Date() },
      update: { owner, lockedAt: new Date() },
    });
    this.logger.debug(`Lock acquired: ${documentId} by ${owner}`);
  }

  async release(documentId: string): Promise<void> {
    await this.prisma.processingLock.deleteMany({ where: { documentId } });
    this.logger.debug(`Lock released: ${documentId}`);
  }

  async isLocked(documentId: string): Promise<boolean> {
    const lock = await this.prisma.processingLock.findUnique({ where: { documentId } });
    if (!lock) return false;
    const staleCutoff = new Date(Date.now() - LOCK_TIMEOUT_MS);
    return lock.lockedAt > staleCutoff;
  }
}
