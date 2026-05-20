import { Controller, Get, Post, Param, Body, Query, HttpCode, HttpStatus, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { EmailCopilotService } from "./email-copilot.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuditService } from "../audit/audit.service";

@Controller("api/email-copilot")
@Roles("owner", "administrator", "sales")
export class EmailCopilotController {
  constructor(
    private readonly service: EmailCopilotService,
    private readonly audit: AuditService,
  ) {}

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
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  analyze(@Param("id") id: string) {
    return this.service.analyzeOne(id);
  }

  @Post("reply")
  @HttpCode(HttpStatus.OK)
  async reply(@Body() body: { messageId: string; replyBody: string; sentBy: string }, @CurrentUser() user: any, @Req() req: any) {
    const result = await this.service.replyToEmail(body);
    this.audit.log({ userId: user?.sub, action: "email.reply_sent", entityType: "email_message", entityId: body.messageId, ipAddress: req.ip });
    return result;
  }

  @Post("create-rfq")
  @HttpCode(HttpStatus.OK)
  async createRfq(@Body() body: { messageId: string; title: string }, @CurrentUser() user: any, @Req() req: any) {
    const result = await this.service.createRfq(body);
    this.audit.log({ userId: user?.sub, action: "email.rfq_created", entityType: "email_message", entityId: body.messageId, newData: { title: body.title }, ipAddress: req.ip });
    return result;
  }

  @Post("archive/:id")
  @HttpCode(HttpStatus.OK)
  async archive(@Param("id") id: string, @CurrentUser() user: any, @Req() req: any) {
    const result = await this.service.archiveEmail(id);
    this.audit.log({ userId: user?.sub, action: "email.archived", entityType: "email_message", entityId: id, ipAddress: req.ip });
    return result;
  }
}
