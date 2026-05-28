import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { EmailCopilotModule } from "./email-copilot/email-copilot.module";
import { AiBomModule } from "./ai-bom/ai-bom.module";

@Module({
  imports: [PrismaModule, EmailCopilotModule, AiBomModule],
})
export class AppModule {}