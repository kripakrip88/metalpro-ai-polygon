import { Module } from "@nestjs/common";
import { EmailCopilotController } from "./email-copilot.controller";
import { EmailCopilotService } from "./email-copilot.service";
import { ImapService } from "./imap.service";
import { SmtpService } from "./smtp.service";
import { AiAnalysisService } from "./ai-analysis.service";
import { EmailRepository } from "./email.repository";

@Module({
  controllers: [EmailCopilotController],
  providers: [EmailCopilotService, ImapService, SmtpService, AiAnalysisService, EmailRepository],
})
export class EmailCopilotModule {}