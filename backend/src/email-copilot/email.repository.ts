import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class EmailRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filters: { status?: string; intent?: string } = {}) {
    return this.prisma.emailMessage.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.intent ? { aiIntent: filters.intent } : {}),
      },
      orderBy: { receivedAt: "desc" },
      take: 100,
    });
  }

  findByMessageId(messageId: string) {
    return this.prisma.emailMessage.findUnique({ where: { messageId } });
  }

  findById(id: string) {
    return this.prisma.emailMessage.findUnique({ where: { id } });
  }

  create(data: any) {
    return this.prisma.emailMessage.create({ data });
  }

  updateStatus(id: string, status: string) {
    return this.prisma.emailMessage.update({ where: { id }, data: { status, updatedAt: new Date() } });
  }

  updateAnalysis(id: string, a: any) {
    return this.prisma.emailMessage.update({
      where: { id },
      data: {
        aiIntent: a.intent, aiPriority: a.priority, aiConfidence: a.confidence,
        aiSummary: a.summary, aiExtracted: a.extracted, aiDrafts: a.drafts,
        aiSuggestRfq: a.suggestRfq, aiModelUsed: "claude", updatedAt: new Date(),
      },
    });
  }
}