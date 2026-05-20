import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class MaterialsDictionaryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByAlias(alias: string) {
    return this.prisma.materialDictionary.findFirst({
      where: {
        aliases: { has: alias },
        deletedAt: null,
        active: true,
      },
    });
  }

  findAll() {
    return this.prisma.materialDictionary.findMany({
      where: { deletedAt: null, active: true },
      orderBy: { normalizedName: "asc" },
    });
  }

  findById(id: string) {
    return this.prisma.materialDictionary.findUnique({ where: { id } });
  }
}
