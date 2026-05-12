import { Injectable } from "@nestjs/common";

@Injectable()
export class UnparsedFragmentRepository {
  async createMany(fragments: any[]) { throw new Error("Not implemented"); }
  async findByDocumentId(documentId: string) { throw new Error("Not implemented"); }
  async findAll(limit = 100) { throw new Error("Not implemented"); }
}
