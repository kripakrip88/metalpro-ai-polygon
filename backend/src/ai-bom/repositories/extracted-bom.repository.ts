import { Injectable } from "@nestjs/common";

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
  async create(data: ExtractedBomData): Promise<ExtractedBom> {
    throw new Error("Not implemented — connect Prisma");
  }

  async createItems(items: ExtractedBomItemData[]): Promise<ExtractedBomItem[]> {
    throw new Error("Not implemented — connect Prisma");
  }

  async findByAssemblyId(assemblyId: string): Promise<ExtractedBom | null> {
    throw new Error("Not implemented — connect Prisma");
  }

  async findItemsByBomId(bomId: string): Promise<ExtractedBomItem[]> {
    throw new Error("Not implemented — connect Prisma");
  }
}
