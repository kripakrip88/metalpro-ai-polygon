import { Module } from "@nestjs/common";
import { EmailCopilotController } from "./email-copilot.controller";
import { ImapPollerService } from "./services/imap-poller.service";
import { EmailParserService } from "./services/email-parser.service";
import { AiRouterService } from "./services/ai-router.service";
import { EmailAnalyzerService } from "./services/email-analyzer.service";
import { LlamaClassifierService } from "./services/llama-classifier.service";
import { SmtpSenderService } from "./services/smtp-sender.service";
import { CrmService } from "./services/crm.service";
import { EmailThreadRepository } from "./repositories/email-thread.repository";
import { EmailMessageRepository } from "./repositories/email-message.repository";

@Module({
  controllers: [EmailCopilotController],
  providers: [
    ImapPollerService,
    EmailParserService,
    AiRouterService,
    EmailAnalyzerService,
    LlamaClassifierService,
    SmtpSenderService,
    CrmService,
    EmailThreadRepository,
    EmailMessageRepository,
  ],
  exports: [CrmService],
})
export class EmailCopilotModule {}
