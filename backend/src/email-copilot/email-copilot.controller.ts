import { Controller, Get, Post, Param, Body, Query, HttpCode, HttpStatus } from "@nestjs/common";
import { EmailCopilotService } from "./email-copilot.service";

@Controller("api/email-copilot")
export class EmailCopilotController {
  constructor(private readonly service: EmailCopilotService) {}

  @Get("inbox")
  inbox(@Query("status") status?: string, @Query("intent") intent?: string) {
    return this.service.getInbox({ status, intent });
  }

  @Post("poll")
  @HttpCode(HttpStatus.OK)
  poll() {
    return this.service.pollNewEmails();
  }

  @Post("analyze/:id")
  @HttpCode(HttpStatus.OK)
  analyze(@Param("id") id: string) {
    return this.service.analyzeOne(id);
  }

  @Post("reply")
  @HttpCode(HttpStatus.OK)
  reply(@Body() body: { messageId: string; replyBody: string; sentBy: string }) {
    return this.service.replyToEmail(body);
  }

  @Post("create-rfq")
  @HttpCode(HttpStatus.OK)
  createRfq(@Body() body: { messageId: string; title: string }) {
    return this.service.createRfq(body);
  }

  @Post("archive/:id")
  @HttpCode(HttpStatus.OK)
  archive(@Param("id") id: string) {
    return this.service.archiveEmail(id);
  }
}
