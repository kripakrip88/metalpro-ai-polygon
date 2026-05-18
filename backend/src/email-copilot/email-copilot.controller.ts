import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus } from "@nestjs/common";
import { EmailMessageRepository } from "./repositories/email-message.repository";
import { EmailThreadRepository } from "./repositories/email-thread.repository";
import { ImapPollerService } from "./services/imap-poller.service";
import { SmtpSenderService } from "./services/smtp-sender.service";
import { CrmService } from "./services/crm.service";
import { SendReplyDto, CreateRfqDto } from "./dto/send-reply.dto";

@Controller("api/email-copilot")
export class EmailCopilotController {
  constructor(
    private readonly messageRepo: EmailMessageRepository,
    private readonly threadRepo: EmailThreadRepository,
    private readonly poller: ImapPollerService,
    private readonly smtp: SmtpSenderService,
    private readonly crm: CrmService,
  ) {}

  @Get("inbox")
  async getInbox(
    @Query("status") status?: string,
    @Query("intent") intent?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const l = Math.min(parseInt(limit ?? "50", 10), 200);
    const o = parseInt(offset ?? "0", 10);
    const [messages, total] = await Promise.all([
      this.messageRepo.findAll({ status, intent }, l, o),
      this.messageRepo.countAll({ status, intent }),
    ]);
    return { messages, total, limit: l, offset: o };
  }

  @Get("thread/:id")
  async getThread(@Param("id") id: string) {
    const [thread, messages] = await Promise.all([
      this.threadRepo.findById(id),
      this.messageRepo.findByThreadId(id),
    ]);
    return { thread, messages };
  }

  @Post("reply")
  @HttpCode(HttpStatus.OK)
  async sendReply(@Body() dto: SendReplyDto) {
    const message = await this.messageRepo.findByMessageId(dto.messageId);
    if (!message) return { success: false, error: "Message not found" };

    const subject = message.subject?.startsWith("Re:") ? message.subject : `Re: ${message.subject ?? ""}`;
    await this.smtp.send(message.fromAddress, subject, dto.replyBody, dto.messageId);

    await this.messageRepo.markReplied(message.id);

    // Save outbound interaction to CRM
    if (message.thread?.erpCustomerId) {
      await this.crm.saveInteraction({
        customerId: message.thread.erpCustomerId,
        type:       "EMAIL",
        direction:  "OUTBOUND",
        subject,
        body:       dto.replyBody.slice(0, 2000),
      }).catch(() => {});
    }

    return { success: true };
  }

  @Post("create-rfq")
  @HttpCode(HttpStatus.OK)
  async createRfq(@Body() dto: CreateRfqDto) {
    const order = await this.crm.createOrder({
      customerName: dto.customerName,
      title:        dto.title,
      description:  dto.description,
    });
    // Link thread to the new order
    const message = await this.messageRepo.findByMessageId(dto.messageId).catch(() => null);
    if (message?.threadId) {
      await this.threadRepo.linkOrder(message.threadId, order.id).catch(() => {});
    }
    return { success: true, orderId: order.id, orderNumber: order.orderNumber };
  }

  @Post("poll")
  @HttpCode(HttpStatus.OK)
  async triggerPoll() {
    const result = await this.poller.poll();
    return result;
  }

  @Post("archive/:id")
  @HttpCode(HttpStatus.OK)
  async archive(@Param("id") id: string) {
    await this.messageRepo.archive(id);
    return { success: true };
  }
}
