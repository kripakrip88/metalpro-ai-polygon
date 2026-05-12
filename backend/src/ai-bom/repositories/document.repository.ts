import { Injectable } from "@nestjs/common";

@Injectable()
export class DocumentRepository {
  async create(data: any) { throw new Error("Not implemented — connect Prisma"); }
  async findById(id: string) { throw new Error("Not implemented"); }
  async findByChecksum(sha256Checksum: string) { throw new Error("Not implemented"); }
  async findAll() { throw new Error("Not implemented"); }
  async updateStatus(id: string, status: string, extra?: any) { throw new Error("Not implemented"); }
  async updateLlamaStatus(id: string, data: any) { throw new Error("Not implemented"); }
  async saveOcrResult(id: string, data: any) { throw new Error("Not implemented"); }
  async incrementRetry(id: string) { throw new Error("Not implemented"); }
  async resetForReprocess(id: string) { throw new Error("Not implemented"); }
  async markFailed(id: string, error: string) { throw new Error("Not implemented"); }
}
