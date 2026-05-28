import { Injectable } from "@nestjs/common";

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
  async create(data: ExtractedCoatingData): Promise<ExtractedCoating> {
    throw new Error("Not implemented — connect Prisma");
  }

  async findByDocumentId(documentId: string): Promise<ExtractedCoating[]> {
    throw new Error("Not implemented — connect Prisma");
  }
}
