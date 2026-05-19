import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { AiBomModule } from "./ai-bom/ai-bom.module";
import { EmailCopilotModule } from "./email-copilot/email-copilot.module";

@Module({
  imports: [PrismaModule, AiBomModule, EmailCopilotModule],
})
export class AppModule {}