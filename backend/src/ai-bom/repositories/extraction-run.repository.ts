import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ExtractionRunRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: any) {
    return this.prisma.extractionRun.create({ data });
  }

  saveRawResponse(id: string, rawResponse: string, parsedJson?: any) {
    return this.prisma.extractionRun.update({
      where: { id },
      data: {
        rawResponse,
        ...(parsedJson !== undefined ? { parsedJson } : {}),
        completedAt: new Date(),
        status: "completed",
      },
    });
  }

  markFailed(id: string, errorMessage: string) {
    return this.prisma.extractionRun.update({
      where: { id },
      data: { status: "failed", errorMessage, completedAt: new Date() },
    });
  }

  findByDocumentId(documentId: string) {
    return this.prisma.extractionRun.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: string) {
    return this.prisma.extractionRun.findUnique({ where: { id } });
  }
}
