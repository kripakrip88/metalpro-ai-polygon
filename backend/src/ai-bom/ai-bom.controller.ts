import { Controller, Post, Get, Param, UploadedFile, UseInterceptors, ParseUUIDPipe, HttpCode, HttpStatus, Body, Req } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { AiBomService } from "./services/ai-bom.service";
import { N8nOrchestratorService } from "./services/n8n-orchestrator.service";
import { ConfirmBomDto } from "./dto/confirm-bom.dto";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuditService } from "../audit/audit.service";

@Controller("api/ai-bom")
export class AiBomController {
  constructor(
    private readonly aiBomService: AiBomService,
    private readonly n8nOrchestrator: N8nOrchestratorService,
    private readonly audit: AuditService,
  ) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles("owner", "administrator", "sales", "engineer")
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async uploadDocument(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: any, @Req() req: any) {
    const result = await this.aiBomService.uploadDocument(file);
    this.audit.log({ userId: user?.sub, action: "document.upload", entityType: "document", entityId: result.documentId, newData: { filename: file.originalname, duplicate: result.duplicate }, ipAddress: req.ip });
    return result;
  }

  @Get("documents")
  @Roles("owner", "administrator", "sales", "engineer", "production", "warehouse")
  async listDocuments() { return this.aiBomService.listDocuments(); }

  @Get("document/:id")
  @Roles("owner", "administrator", "sales", "engineer", "production", "warehouse")
  async getDocument(@Param("id", ParseUUIDPipe) id: string) {
    return this.aiBomService.getDocument(id);
  }

  @Post("document/:id/reprocess-ocr")
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles("owner", "administrator", "engineer")
  async reprocessOcr(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: any, @Req() req: any) {
    const result = await this.aiBomService.reprocessOcr(id, user?.sub);
    this.audit.log({ userId: user?.sub, action: "document.reprocess_ocr", entityType: "document", entityId: id, ipAddress: req.ip });
    return result;
  }

  @Post("confirm/:id")
  @Roles("owner", "administrator", "sales", "engineer")
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async confirmBom(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ConfirmBomDto, @CurrentUser() user: any, @Req() req: any) {
    const result = await this.aiBomService.confirmBom(id, dto);
    this.audit.log({ userId: user?.sub, action: "bom.confirmed", entityType: "document", entityId: id, newData: { itemsCount: dto.items?.length, confirmedBy: dto.confirmedBy }, ipAddress: req.ip });
    return result;
  }

  @Public()
  @Post("internal/ocr-callback")
  @HttpCode(HttpStatus.OK)
  async ocrCallback(@Body() payload: unknown) {
    const validated = this.n8nOrchestrator.validateCallback(payload);
    return this.aiBomService.handleOcrCallback(validated);
  }
}
