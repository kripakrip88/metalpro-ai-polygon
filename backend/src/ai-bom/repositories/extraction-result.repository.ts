import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ExtractionResultRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByDocumentId(documentId: string) {
    return this.prisma.extractionResult.findMany({
      where: { documentId, deletedAt: null },
      include: { materialDictionary: true },
      orderBy: { createdAt: "asc" },
    });
  }

  findById(id: string) {
    return this.prisma.extractionResult.findUnique({
      where: { id },
      include: { materialDictionary: true },
    });
  }

  createMany(items: any[]) {
    return this.prisma.extractionResult.createMany({ data: items, skipDuplicates: true });
  }

  confirm(id: string, data: Record<string, any>) {
    return this.prisma.extractionResult.update({
      where: { id },
      data: { ...data, confirmedAt: new Date(), updatedAt: new Date() },
    });
  }
}
