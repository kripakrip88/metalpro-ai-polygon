import { Injectable } from "@nestjs/common";

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
  async createMany(items: ExtractedAssemblyData[]): Promise<ExtractedAssembly[]> {
    throw new Error("Not implemented — connect Prisma");
  }

  async findByDocumentId(documentId: string): Promise<ExtractedAssembly[]> {
    throw new Error("Not implemented — connect Prisma");
  }

  async findById(id: string): Promise<ExtractedAssembly | null> {
    throw new Error("Not implemented — connect Prisma");
  }
}
