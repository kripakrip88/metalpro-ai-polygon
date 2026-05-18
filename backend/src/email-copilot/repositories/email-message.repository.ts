import { Injectable } from "@nestjs/common";

@Injectable()
export class EmailMessageRepository {
  async create(data: any): Promise<any> { throw new Error("Not implemented — connect Prisma"); }
  async findByMessageId(messageId: string): Promise<any | null> { throw new Error("Not implemented"); }
  async findByThreadId(threadId: string): Promise<any[]> { throw new Error("Not implemented"); }
  async findPending(limit: number): Promise<any[]> { throw new Error("Not implemented"); }
  async findAll(filter: { status?: string; intent?: string }, limit: number, offset: number): Promise<any[]> { throw new Error("Not implemented"); }
  async countAll(filter: { status?: string; intent?: string }): Promise<number> { throw new Error("Not implemented"); }
  async markReplied(id: string): Promise<void> { throw new Error("Not implemented"); }
  async archive(id: string): Promise<void> { throw new Error("Not implemented"); }
}
