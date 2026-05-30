import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface BomExtractionJob {
  id: string;
  rfqId: string;
  assemblies: any;
  status: string;
  filePath: string | null;
  itemsCreated: number | null;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

@Injectable()
export class BomExtractionJobRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    rfqId: string;
    assemblies: any;
    filePath?: string;
  }): Promise<BomExtractionJob> {
    const row = await this.prisma.bomExtractionJob.create({
      data: {
        rfqId: data.rfqId,
        assemblies: data.assemblies,
        filePath: data.filePath ?? null,
      },
    });
    return this.toEntity(row);
  }

  async findById(id: string): Promise<BomExtractionJob | null> {
    const row = await this.prisma.bomExtractionJob.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async complete(id: string, itemsCreated: number): Promise<void> {
    await this.prisma.bomExtractionJob.update({
      where: { id },
      data: { status: "completed", itemsCreated, completedAt: new Date() },
    });
  }

  async fail(id: string, errorMessage: string): Promise<void> {
    await this.prisma.bomExtractionJob.update({
      where: { id },
      data: { status: "failed", errorMessage, completedAt: new Date() },
    });
  }

  private toEntity(row: any): BomExtractionJob {
    return {
      id: row.id,
      rfqId: row.rfqId,
      assemblies: row.assemblies,
      status: row.status,
      filePath: row.filePath ?? null,
      itemsCreated: row.itemsCreated ?? null,
      errorMessage: row.errorMessage ?? null,
      createdAt: row.createdAt,
      completedAt: row.completedAt ?? null,
    };
  }
}
