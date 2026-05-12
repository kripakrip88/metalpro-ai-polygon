import { Injectable } from "@nestjs/common";

@Injectable()
export class CorrectionsRepository {
  async create(data: any) { throw new Error("Not implemented"); }
  async findByDocumentId(documentId: string) { throw new Error("Not implemented"); }
}
