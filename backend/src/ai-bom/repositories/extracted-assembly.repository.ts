import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface ExtractedAssemblyData {
  documentId: string;
  name: string;
  designation?: string;
  quantity: number;
  unit: string;
  massKg?: number;
  sourceHint: string;
  sourceReference?: string;
  confidence?: number;
  rawText: string;
}

export interface ExtractedAssembly extends ExtractedAssemblyData {
  id: string;
  createdAt: Date;
}

@Injectable()
export class ExtractedAssemblyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createMany(items: ExtractedAssemblyData[]): Promise<ExtractedAssembly[]> {
    const created = await this.prisma.$transaction(
      items.map(item =>
        this.prisma.extractedAssembly.create({
          data: {
            documentId: item.documentId,
            name: item.name,
            designation: item.designation,
            quantity: item.quantity,
            unit: item.unit,
            massKg: item.massKg,
            sourceHint: item.sourceHint,
            sourceReference: item.sourceReference,
            confidence: item.confidence,
            rawText: item.rawText,
          },
        }),
      ),
    );
    return created.map(this.toEntity);
  }

  async findByDocumentId(documentId: string): Promise<ExtractedAssembly[]> {
    const rows = await this.prisma.extractedAssembly.findMany({
      where: { documentId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(this.toEntity);
  }

  async findById(id: string): Promise<ExtractedAssembly | null> {
    const row = await this.prisma.extractedAssembly.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  private toEntity(row: any): ExtractedAssembly {
    return {
      id: row.id,
      documentId: row.documentId,
      name: row.name,
      designation: row.designation ?? undefined,
      quantity: Number(row.quantity),
      unit: row.unit,
      massKg: row.massKg != null ? Number(row.massKg) : undefined,
      sourceHint: row.sourceHint,
      sourceReference: row.sourceReference ?? undefined,
      confidence: row.confidence != null ? Number(row.confidence) : undefined,
      rawText: row.rawText,
      createdAt: row.createdAt,
    };
  }
}
