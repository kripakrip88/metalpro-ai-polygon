import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { EmailParserService } from "./email-parser.service";
import { EmailMessageRepository } from "../repositories/email-message.repository";
import { EmailThreadRepository } from "../repositories/email-thread.repository";
import { AiRouterService } from "./ai-router.service";
import { EmailAnalyzerService } from "./email-analyzer.service";
import { LlamaClassifierService } from "./llama-classifier.service";
import { CrmService } from "./crm.service";
import { ParsedEmail } from "../types/email.types";

const POLL_INTERVAL_MS = parseInt(process.env.IMAP_POLL_INTERVAL_MS ?? "120000", 10);

@Injectable()
export class ImapPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImapPollerService.name);
  private pollTimer: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor(
    private readonly parser: EmailParserService,
    private readonly messageRepo: EmailMessageRepository,
    private readonly threadRepo: EmailThreadRepository,
    private readonly router: AiRouterService,
    private readonly analyzer: EmailAnalyzerService,
    private readonly llamaClassifier: LlamaClassifierService,
    private readonly crm: CrmService,
  ) {}

  onModuleInit() {
    if (!process.env.IMAP_HOST) {
      this.logger.warn("IMAP_HOST not set — email polling disabled");
      return;
    }
    this.schedulePoll();
    this.logger.log(`IMAP poller started (interval: ${POLL_INTERVAL_MS / 1000}s)`);
  }

  onModuleDestroy() {
    if (this.pollTimer) clearTimeout(this.pollTimer);
  }

  private schedulePoll() {
    this.pollTimer = setTimeout(async () => {
      await this.poll();
      this.schedulePoll();
    }, POLL_INTERVAL_MS);
  }

  async poll(): Promise<{ processed: number }> {
    if (this.isPolling) return { processed: 0 };
    this.isPolling = true;
    let processed = 0;
    try {
      const emails = await this.parser.fetchNew();
      this.logger.log(`Poll complete: ${emails.length} new message(s)`);
      for (const email of emails) {
        try {
          await this.processEmail(email);
          processed++;
        } catch (err) {
          this.logger.error(`Failed to process ${email.messageId}: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      this.logger.error(`Poll error: ${(err as Error).message}`);
    } finally {
      this.isPolling = false;
    }
    return { processed };
  }

  private async processEmail(email: ParsedEmail) {
    const existing = await this.messageRepo.findByMessageId(email.messageId).catch(() => null);
    if (existing) return;

    let thread = await this.threadRepo.findBySubject(email.subject).catch(() => null);
    if (!thread) {
      thread = await this.threadRepo.create({ subject: email.subject, status: "new" });
    }

    const customer = await this.crm.findCustomerByEmail(email.from).catch(() => null);

    const useModel = this.router.route(email);
    const history = customer ? await this.crm.getInteractionHistory(customer.id, 5).catch(() => []) : [];
    const analysis = useModel === "claude"
      ? await this.analyzer.analyze(email, history)
      : await this.llamaClassifier.classify(email);

    await this.messageRepo.create({
      threadId:      thread.id,
      messageId:     email.messageId,
      direction:     "inbound",
      fromAddress:   email.from,
      toAddress:     email.to,
      subject:       email.subject,
      bodyText:      email.bodyText,
      bodyHtml:      email.bodyHtml,
      receivedAt:    email.receivedAt,
      aiIntent:      analysis.intent,
      aiPriority:    analysis.priority,
      aiConfidence:  analysis.confidence,
      aiSummary:     analysis.summary,
      aiExtracted:   analysis.extracted,
      aiDrafts:      analysis.drafts,
      aiModelUsed:   analysis.modelUsed,
      status:        "pending",
    });

    if (customer) {
      await this.threadRepo.linkCustomer(thread.id, customer.id).catch(() => {});
      await this.crm.saveInteraction({
        customerId:     customer.id,
        type:           "EMAIL",
        direction:      "INBOUND",
        subject:        email.subject,
        body:           email.bodyText.slice(0, 2000),
        emailMessageId: email.messageId,
      }).catch(err => this.logger.warn(`Interaction save failed: ${err.message}`));
    }

    this.logger.log(`Processed ${email.messageId}: ${analysis.intent} / ${analysis.priority} via ${analysis.modelUsed}`);
  }
}
