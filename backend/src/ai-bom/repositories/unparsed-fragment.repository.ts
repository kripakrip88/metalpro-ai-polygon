import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class UnparsedFragmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  createMany(fragments: any[]) {
    return this.prisma.unparsedFragment.createMany({ data: fragments, skipDuplicates: true });
  }

  findByDocumentId(documentId: string) {
    return this.prisma.unparsedFragment.findMany({
      where: { documentId },
      orderBy: { createdAt: "asc" },
    });
  }

  findAll(limit = 100) {
    return this.prisma.unparsedFragment.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
