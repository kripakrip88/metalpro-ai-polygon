import { Injectable } from "@nestjs/common";

@Injectable()
export class ExtractionItemRepository {
  async createMany(items: any[]) { throw new Error("Not implemented"); }
  async findByRunId(extractionRunId: string) { throw new Error("Not implemented"); }
  async findByDocumentId(documentId: string) { throw new Error("Not implemented"); }
}
