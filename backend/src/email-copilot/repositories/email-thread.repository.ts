import { Injectable } from "@nestjs/common";

@Injectable()
export class EmailThreadRepository {
  async create(data: { subject: string; status: string }): Promise<any> { throw new Error("Not implemented — connect Prisma"); }
  async findBySubject(subject: string): Promise<any | null> { throw new Error("Not implemented"); }
  async findAll(limit: number, offset: number): Promise<any[]> { throw new Error("Not implemented"); }
  async findById(id: string): Promise<any | null> { throw new Error("Not implemented"); }
  async linkCustomer(id: string, customerId: string, contactId?: string): Promise<void> { throw new Error("Not implemented"); }
  async linkOrder(id: string, orderId: string): Promise<void> { throw new Error("Not implemented"); }
  async updateStatus(id: string, status: string): Promise<void> { throw new Error("Not implemented"); }
}
