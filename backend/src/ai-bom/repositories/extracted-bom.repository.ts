import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface ExtractedBomData {
  assemblyId: string;
  sourceDocumentId: string;
  sourceHint: string;
  sourceReference?: string;
  extractionRunId?: string;
}

export interface ExtractedBom extends ExtractedBomData {
  id: string;
  createdAt: Date;
}

export interface ExtractedBomItemData {
  bomId: string;
  positionNumber?: number;
  name: string;
  profileType: string;
  steelGrade?: string;
  gost?: string;
  lengthMm?: number;
  thicknessMm?: number;
  widthMm?: number;
  heightMm?: number;
  quantity: number;
  unit: string;
  massUnitKg?: number;
  massTotalKg?: number;
  coatingId?: string;
  confidence?: number;
  rawText: string;
}

export interface ExtractedBomItem extends ExtractedBomItemData {
  id: string;
  createdAt: Date;
}

@Injectable()
export class ExtractedBomRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: ExtractedBomData): Promise<ExtractedBom> {
    const row = await this.prisma.extractedBom.create({
      data: {
        assemblyId: data.assemblyId,
        sourceDocumentId: data.sourceDocumentId,
        sourceHint: data.sourceHint,
        sourceReference: data.sourceReference,
        extractionRunId: data.extractionRunId,
      },
    });
    return this.toBomEntity(row);
  }

  async createItems(items: ExtractedBomItemData[]): Promise<ExtractedBomItem[]> {
    const created = await this.prisma.$transaction(
      items.map(item =>
        this.prisma.extractedBomItem.create({
          data: {
            bomId: item.bomId,
            positionNumber: item.positionNumber,
            name: item.name,
            profileType: item.profileType,
            steelGrade: item.steelGrade,
            gost: item.gost,
            lengthMm: item.lengthMm,
            thicknessMm: item.thicknessMm,
            widthMm: item.widthMm,
            heightMm: item.heightMm,
            quantity: item.quantity,
            unit: item.unit,
            massUnitKg: item.massUnitKg,
            massTotalKg: item.massTotalKg,
            coatingId: item.coatingId,
            confidence: item.confidence,
            rawText: item.rawText,
          },
        }),
      ),
    );
    return created.map(this.toItemEntity);
  }

  async findByAssemblyId(assemblyId: string): Promise<ExtractedBom | null> {
    const row = await this.prisma.extractedBom.findFirst({
      where: { assemblyId },
      orderBy: { createdAt: "desc" },
    });
    return row ? this.toBomEntity(row) : null;
  }

  async findItemsByBomId(bomId: string): Promise<ExtractedBomItem[]> {
    const rows = await this.prisma.extractedBomItem.findMany({
      where: { bomId },
      orderBy: [{ positionNumber: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(this.toItemEntity);
  }

  private toBomEntity(row: any): ExtractedBom {
    return {
      id: row.id,
      assemblyId: row.assemblyId,
      sourceDocumentId: row.sourceDocumentId,
      sourceHint: row.sourceHint,
      sourceReference: row.sourceReference ?? undefined,
      extractionRunId: row.extractionRunId ?? undefined,
      createdAt: row.createdAt,
    };
  }

  private toItemEntity(row: any): ExtractedBomItem {
    return {
      id: row.id,
      bomId: row.bomId,
      positionNumber: row.positionNumber ?? undefined,
      name: row.name,
      profileType: row.profileType,
      steelGrade: row.steelGrade ?? undefined,
      gost: row.gost ?? undefined,
      lengthMm: row.lengthMm != null ? Number(row.lengthMm) : undefined,
      thicknessMm: row.thicknessMm != null ? Number(row.thicknessMm) : undefined,
      widthMm: row.widthMm != null ? Number(row.widthMm) : undefined,
      heightMm: row.heightMm != null ? Number(row.heightMm) : undefined,
      quantity: Number(row.quantity),
      unit: row.unit,
      massUnitKg: row.massUnitKg != null ? Number(row.massUnitKg) : undefined,
      massTotalKg: row.massTotalKg != null ? Number(row.massTotalKg) : undefined,
      coatingId: row.coatingId ?? undefined,
      confidence: row.confidence != null ? Number(row.confidence) : undefined,
      rawText: row.rawText,
      createdAt: row.createdAt,
    };
  }
}
