import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface ExtractedCoatingData {
  documentId: string;
  name: string;
  thicknessMicron?: number;
  layers?: number;
  areaM2?: number;
  rawText: string;
}

export interface ExtractedCoating extends ExtractedCoatingData {
  id: string;
  createdAt: Date;
}

@Injectable()
export class ExtractedCoatingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: ExtractedCoatingData): Promise<ExtractedCoating> {
    const row = await this.prisma.extractedCoating.create({
      data: {
        documentId: data.documentId,
        name: data.name,
        thicknessMicron: data.thicknessMicron,
        layers: data.layers,
        areaM2: data.areaM2,
        rawText: data.rawText,
      },
    });
    return this.toEntity(row);
  }

  async findByDocumentId(documentId: string): Promise<ExtractedCoating[]> {
    const rows = await this.prisma.extractedCoating.findMany({
      where: { documentId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(this.toEntity);
  }

  private toEntity(row: any): ExtractedCoating {
    return {
      id: row.id,
      documentId: row.documentId,
      name: row.name,
      thicknessMicron: row.thicknessMicron ?? undefined,
      layers: row.layers ?? undefined,
      areaM2: row.areaM2 != null ? Number(row.areaM2) : undefined,
      rawText: row.rawText,
      createdAt: row.createdAt,
    };
  }
}
