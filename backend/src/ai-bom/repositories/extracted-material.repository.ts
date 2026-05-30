import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface ExtractedMaterialData {
  bomItemId: string;
  erpMaterialId?: string;
  matchedName: string;
  matchConfidence: number;
  matchMethod: "exact" | "alias" | "ai_suggested" | "manual";
  reviewedBy?: string;
}

export interface ExtractedMaterial extends ExtractedMaterialData {
  id: string;
  createdAt: Date;
}

@Injectable()
export class ExtractedMaterialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: ExtractedMaterialData): Promise<ExtractedMaterial> {
    const row = await this.prisma.extractedMaterial.create({
      data: {
        bomItemId: data.bomItemId,
        erpMaterialId: data.erpMaterialId,
        matchedName: data.matchedName,
        matchConfidence: data.matchConfidence,
        matchMethod: data.matchMethod,
        reviewedBy: data.reviewedBy,
      },
    });
    return this.toEntity(row);
  }

  async createMany(items: ExtractedMaterialData[]): Promise<ExtractedMaterial[]> {
    const created = await this.prisma.$transaction(
      items.map(item =>
        this.prisma.extractedMaterial.create({
          data: {
            bomItemId: item.bomItemId,
            erpMaterialId: item.erpMaterialId,
            matchedName: item.matchedName,
            matchConfidence: item.matchConfidence,
            matchMethod: item.matchMethod,
            reviewedBy: item.reviewedBy,
          },
        }),
      ),
    );
    return created.map(this.toEntity);
  }

  async findByBomItemId(bomItemId: string): Promise<ExtractedMaterial | null> {
    const row = await this.prisma.extractedMaterial.findUnique({ where: { bomItemId } });
    return row ? this.toEntity(row) : null;
  }

  private toEntity(row: any): ExtractedMaterial {
    return {
      id: row.id,
      bomItemId: row.bomItemId,
      erpMaterialId: row.erpMaterialId ?? undefined,
      matchedName: row.matchedName,
      matchConfidence: Number(row.matchConfidence),
      matchMethod: row.matchMethod as ExtractedMaterialData["matchMethod"],
      reviewedBy: row.reviewedBy ?? undefined,
      createdAt: row.createdAt,
    };
  }
}
