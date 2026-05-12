import { Injectable } from "@nestjs/common";

@Injectable()
export class ExtractionResultRepository {
  async findByDocumentId(documentId: string) { throw new Error("Not implemented"); }
  async findById(id: string) { throw new Error("Not implemented"); }
  async createMany(items: any[]) { throw new Error("Not implemented"); }
  async confirm(id: string, data: any) { throw new Error("Not implemented"); }
}
