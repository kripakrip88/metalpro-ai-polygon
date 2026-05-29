import { Controller, Post, Get, Param, UploadedFile, UseInterceptors, ParseUUIDPipe, HttpCode, HttpStatus, Body } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AiBomService } from "./services/ai-bom.service";
import { N8nOrchestratorService } from "./services/n8n-orchestrator.service";
import { ConfirmBomDto } from "./dto/confirm-bom.dto";
import { ExtractBomDto } from "./dto/extract-bom.dto";

@Controller("api/ai-bom")
export class AiBomController {
  constructor(
    private readonly aiBomService: AiBomService,
    private readonly n8nOrchestrator: N8nOrchestratorService,
  ) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  @HttpCode(HttpStatus.ACCEPTED)
  async uploadDocument(@UploadedFile() file: Express.Multer.File) {
    return this.aiBomService.uploadDocument(file);
  }

  @Get("documents")
  async listDocuments() { return this.aiBomService.listDocuments(); }

  @Get("document/:id")
  async getDocument(@Param("id", ParseUUIDPipe) id: string) {
    return this.aiBomService.getDocument(id);
  }

  @Post("document/:id/reprocess-ocr")
  @HttpCode(HttpStatus.ACCEPTED)
  async reprocessOcr(@Param("id", ParseUUIDPipe) id: string, @Body("requestedBy") requestedBy?: string) {
    return this.aiBomService.reprocessOcr(id, requestedBy);
  }

  @Post("confirm/:id")
  async confirmBom(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ConfirmBomDto) {
    return this.aiBomService.confirmBom(id, dto);
  }

  @Get("document/:id/bom-draft")
  async getBomDraft(@Param("id", ParseUUIDPipe) id: string) {
    return this.aiBomService.getBomDraft(id);
  }

  // ── Status polling (erp-metal polls every 3s) ──────────────────────────
  @Get("document/:id/status")
  async getDocumentStatus(@Param("id", ParseUUIDPipe) id: string) {
    return this.aiBomService.getDocumentStatus(id);
  }

  // ── Synchronous assembly extraction (email body, 3-8 sec) ──────────────
  @Post("document/:id/extract-assemblies")
  async extractAssemblies(@Param("id", ParseUUIDPipe) id: string) {
    return this.aiBomService.extractAssemblies(id);
  }

  // ── Async BOM extraction (PDF/photo, up to 80 sec, callback on done) ───
  @Post("document/:id/extract-bom")
  @HttpCode(HttpStatus.ACCEPTED)
  async extractBom(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ExtractBomDto,
  ) {
    return this.aiBomService.triggerBomExtraction(id, dto.assemblyId);
  }

  @Post("internal/ocr-callback")
  @HttpCode(HttpStatus.OK)
  async ocrCallback(@Body() payload: unknown) {
    const validated = this.n8nOrchestrator.validateCallback(payload);
    return this.aiBomService.handleOcrCallback(validated);
  }
}
