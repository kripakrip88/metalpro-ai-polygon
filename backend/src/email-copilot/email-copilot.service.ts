import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { EmailRepository } from "./email.repository";
import { ImapService } from "./imap.service";
import { SmtpService } from "./smtp.service";
import { AiAnalysisService } from "./ai-analysis.service";

@Injectable()
export class EmailCopilotService {
  private readonly logger = new Logger(EmailCopilotService.name);
  private lastPollAt?: Date;

  constructor(
    private readonly repo: EmailRepository,
    private readonly imap: ImapService,
    private readonly smtp: SmtpService,
    private readonly ai: AiAnalysisService,
  ) {}

  async getInbox(filters: { status?: string; intent?: string }) {
    const messages = await this.repo.findAll(filters);
    return { messages, total: messages.length };
  }

  async pollNewEmails() {
    const emails = await this.imap.fetchNewEmails(this.lastPollAt);
    this.lastPollAt = new Date();
    let newCount = 0;
    for (const raw of emails) {
      const exists = await this.repo.findByMessageId(raw.messageId);
      if (exists) continue;
      const saved = await this.repo.create({
        messageId: raw.messageId,
        fromAddress: raw.fromAddress,
        toAddress: raw.toAddress,
        subject: raw.subject,
        bodyText: raw.bodyText,
        receivedAt: raw.receivedAt,
        status: "pending",
        updatedAt: new Date(),
      });
      this.ai.analyzeEmail(raw.subject, raw.bodyText, raw.fromAddress)
        .then(a => this.repo.updateAnalysis(saved.id, a))
        .catch(e => this.logger.error(`Analysis failed ${saved.id}: ${e.message}`));
      newCount++;
    }
    return { received: newCount, total: emails.length };
  }

  async analyzeOne(id: string) {
    const msg = await this.repo.findById(id);
    if (!msg) throw new NotFoundException("Message not found");
    const analysis = await this.ai.analyzeEmail(msg.subject, msg.bodyText, msg.fromAddress);
    return this.repo.updateAnalysis(id, analysis);
  }

  async replyToEmail(data: { messageId: string; replyBody: string; sentBy: string }) {
    const msg = await this.repo.findByMessageId(data.messageId);
    if (!msg) throw new NotFoundException("Message not found");
    await this.smtp.sendReply(msg.fromAddress, msg.subject, data.replyBody, data.messageId);
    await this.repo.updateStatus(msg.id, "replied");
    return { success: true };
  }

  async createRfq(data: { messageId: string; title: string }) {
    const msg = await this.repo.findByMessageId(data.messageId);
    if (!msg) throw new NotFoundException("Message not found");
    const erpUrl = process.env.ERP_METAL_URL ?? "http://5.35.92.112";
    const res = await fetch(`${erpUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderNumber: `RFQ-${Date.now()}`,
        customerName: msg.fromAddress,
        title: data.title,
        description: `Из письма: ${msg.subject}`,
      }),
    });
    if (!res.ok) throw new Error(`ERP error: ${res.status}`);
    const order = await res.json() as any;
    return { success: true, orderId: order.id };
  }

  async archiveEmail(id: string) {
    await this.repo.updateStatus(id, "archived");
    return { success: true };
  }
}
