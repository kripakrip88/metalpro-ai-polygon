import { Injectable } from "@nestjs/common";

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
  async create(data: ExtractedMaterialData): Promise<ExtractedMaterial> {
    throw new Error("Not implemented — connect Prisma");
  }

  async createMany(items: ExtractedMaterialData[]): Promise<ExtractedMaterial[]> {
    throw new Error("Not implemented — connect Prisma");
  }

  async findByBomItemId(bomItemId: string): Promise<ExtractedMaterial | null> {
    throw new Error("Not implemented — connect Prisma");
  }
}
