import { Injectable } from "@nestjs/common";

@Injectable()
export class ExtractionRunRepository {
  async create(data: any) { throw new Error("Not implemented — connect Prisma"); }
  async saveRawResponse(id: string, data: any) { throw new Error("Not implemented"); }
  async markFailed(id: string, error: string) { throw new Error("Not implemented"); }
  async findByDocumentId(documentId: string) { throw new Error("Not implemented"); }
  async findById(id: string) { throw new Error("Not implemented"); }
}
