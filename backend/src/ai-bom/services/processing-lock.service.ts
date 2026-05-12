import { Injectable, Logger, ConflictException } from "@nestjs/common";

const LOCK_TIMEOUT_MS = 10 * 60 * 1000;

@Injectable()
export class ProcessingLockService {
  private readonly logger = new Logger(ProcessingLockService.name);

  async acquire(documentId: string, owner: string): Promise<void> {
    // TODO: implement with Prisma
    // Check processingLockedAt, if stale override, else throw ConflictException
    this.logger.debug(`Lock acquired: ${documentId} by ${owner}`);
  }

  async release(documentId: string): Promise<void> {
    // TODO: implement with Prisma
    this.logger.debug(`Lock released: ${documentId}`);
  }

  async isLocked(documentId: string): Promise<boolean> {
    // TODO: implement with Prisma
    return false;
  }
}
