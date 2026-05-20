import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SupplierRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.supplier.findMany({
      where: { deletedAt: null, active: true },
      include: { aliases: true },
      orderBy: { name: "asc" },
    });
  }

  findByName(name: string) {
    return this.prisma.supplier.findFirst({
      where: {
        name: { contains: name, mode: "insensitive" },
        deletedAt: null,
      },
      include: { aliases: true },
    });
  }

  findMaterialBySupplierAlias(supplierId: string, supplierName: string) {
    return this.prisma.supplierAlias.findFirst({
      where: {
        supplierId,
        supplierName: { contains: supplierName, mode: "insensitive" },
        deletedAt: null,
        active: true,
      },
      include: { supplier: true, materialDictionary: true },
    });
  }
}
