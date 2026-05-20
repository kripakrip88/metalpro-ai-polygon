import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ExtractionItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  createMany(items: any[]) {
    return this.prisma.extractionItem.createMany({ data: items, skipDuplicates: true });
  }

  findByRunId(extractionRunId: string) {
    return this.prisma.extractionItem.findMany({
      where: { extractionRunId },
      orderBy: { createdAt: "asc" },
    });
  }

  findByDocumentId(documentId: string) {
    return this.prisma.extractionItem.findMany({
      where: { documentId },
      orderBy: { createdAt: "asc" },
    });
  }
}
