import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { EmailCopilotModule } from "./email-copilot/email-copilot.module";

@Module({
  imports: [PrismaModule, EmailCopilotModule],
})
export class AppModule {}