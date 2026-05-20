import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CorrectionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: any) {
    return this.prisma.correction.create({ data });
  }

  findByDocumentId(documentId: string) {
    return this.prisma.correction.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
    });
  }
}
