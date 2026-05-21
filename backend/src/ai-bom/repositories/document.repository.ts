import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: any) {
    return this.prisma.document.create({ data });
  }

  findById(id: string) {
    return this.prisma.document.findUnique({ where: { id } });
  }

  findByChecksum(sha256Checksum: string) {
    return this.prisma.document.findUnique({ where: { sha256Checksum } });
  }

  findAll() {
    return this.prisma.document.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  updateStatus(id: string, status: string, extra?: Record<string, any>) {
    return this.prisma.document.update({
      where: { id },
      data: { status, updatedAt: new Date(), ...extra },
    });
  }

  updateLlamaStatus(id: string, data: Record<string, any>) {
    return this.prisma.document.update({ where: { id }, data });
  }

  saveOcrResult(id: string, data: { rawOcrText?: string; cleanedOcrText?: string; ocrEngine?: string; ocrPageCount?: number; ocrMetadata?: any; ocrPreprocessingVersion?: string }) {
    return this.prisma.document.update({
      where: { id },
      data: { ...data, ocrCompletedAt: new Date(), status: "ocr_done" },
    });
  }

  incrementRetry(id: string) {
    return this.prisma.document.update({
      where: { id },
      data: { retryCount: { increment: 1 }, lastRetryAt: new Date() },
    });
  }

  resetForReprocess(id: string) {
    return this.prisma.document.update({
      where: { id },
      data: {
        status: "uploaded",
        retryCount: 0,
        aiError: null,
        processingLockedAt: null,
        processingLockOwner: null,
      },
    });
  }

  markFailed(id: string, error: string) {
    return this.prisma.document.update({
      where: { id },
      data: { status: "ai_failed", aiError: error, aiFailedAt: new Date() },
    });
  }
}
