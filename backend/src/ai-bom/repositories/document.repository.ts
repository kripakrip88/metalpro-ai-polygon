import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

interface DocumentRow {
  id: string;
  status: string;
  storage_provider: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number | null;
  cleaned_ocr_text: string | null;
  raw_ocr_text: string | null;
  ocr_metadata: any;
  ocr_preprocessing_version: string | null;
  retry_count: number;
  sha256_checksum: string | null;
  processing_error: string | null;
  extraction_context: any | null;
  created_at: Date;
  updated_at: Date;
}

function toDoc(row: DocumentRow) {
  return {
    id: row.id,
    status: row.status,
    storageProvider: row.storage_provider,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    cleanedOcrText: row.cleaned_ocr_text,
    rawOcrText: row.raw_ocr_text,
    ocrMetadata: row.ocr_metadata,
    retryCount: row.retry_count ?? 0,
    sha256Checksum: row.sha256_checksum,
    processingError: row.processing_error,
    extractionContext: row.extraction_context ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class DocumentRepository {
  private readonly logger = new Logger(DocumentRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    status: string;
    storageProvider: string;
    storagePath: string;
    originalFilename: string;
    mimeType: string;
    fileSizeBytes: number;
    sha256Checksum: string;
    extractionContext?: any;
  }) {
    const ctx = data.extractionContext != null ? JSON.stringify(data.extractionContext) : null;
    const rows = await this.prisma.$queryRaw<DocumentRow[]>`
      INSERT INTO ai_documents
        (status, storage_provider, storage_path, original_filename, mime_type, file_size_bytes, sha256_checksum, extraction_context)
      VALUES
        (${data.status}, ${data.storageProvider}, ${data.storagePath},
         ${data.originalFilename}, ${data.mimeType}, ${data.fileSizeBytes}, ${data.sha256Checksum},
         ${ctx}::jsonb)
      RETURNING *
    `;
    return toDoc(rows[0]);
  }

  async findById(id: string) {
    const rows = await this.prisma.$queryRaw<DocumentRow[]>`
      SELECT * FROM ai_documents
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return rows[0] ? toDoc(rows[0]) : null;
  }

  async findByChecksum(sha256Checksum: string) {
    const rows = await this.prisma.$queryRaw<DocumentRow[]>`
      SELECT * FROM ai_documents
      WHERE sha256_checksum = ${sha256Checksum} AND deleted_at IS NULL
      LIMIT 1
    `;
    return rows[0] ? toDoc(rows[0]) : null;
  }

  async findAll() {
    const rows = await this.prisma.$queryRaw<DocumentRow[]>`
      SELECT * FROM ai_documents
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    return rows.map(toDoc);
  }

  async updateStatus(id: string, status: string, _extra?: any) {
    await this.prisma.$executeRaw`
      UPDATE ai_documents SET status = ${status}, updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
  }

  async saveOcrResult(id: string, data: {
    rawOcrText: string;
    cleanedOcrText: string;
    ocrMetadata: any;
    ocrPreprocessingVersion: string;
    ocrCompletedAt: Date;
  }) {
    const meta = JSON.stringify(data.ocrMetadata);
    await this.prisma.$executeRaw`
      UPDATE ai_documents SET
        raw_ocr_text             = ${data.rawOcrText},
        cleaned_ocr_text         = ${data.cleanedOcrText},
        ocr_metadata             = ${meta}::jsonb,
        ocr_preprocessing_version = ${data.ocrPreprocessingVersion},
        ocr_completed_at         = ${data.ocrCompletedAt},
        status                   = 'ocr_done',
        updated_at               = NOW()
      WHERE id = ${id}::uuid
    `;
  }

  async updateLlamaStatus(id: string, data: any) {
    await this.prisma.$executeRaw`
      UPDATE ai_documents SET
        llama_run_id      = ${data.llamaRunId ?? null}::uuid,
        llama_completed_at = ${data.llamaCompletedAt ?? null},
        llama_failed_at   = ${data.llamaFailedAt ?? null},
        llama_error       = ${data.llamaError ?? null},
        updated_at        = NOW()
      WHERE id = ${id}::uuid
    `;
  }

  async incrementRetry(id: string) {
    await this.prisma.$executeRaw`
      UPDATE ai_documents SET
        retry_count   = retry_count + 1,
        last_retry_at = NOW(),
        updated_at    = NOW()
      WHERE id = ${id}::uuid
    `;
  }

  async resetForReprocess(id: string) {
    await this.prisma.$executeRaw`
      UPDATE ai_documents SET
        status              = 'uploaded',
        retry_count         = 0,
        cleaned_ocr_text    = NULL,
        raw_ocr_text        = NULL,
        ocr_metadata        = NULL,
        ocr_completed_at    = NULL,
        processing_locked_at = NULL,
        processing_lock_owner = NULL,
        updated_at          = NOW()
      WHERE id = ${id}::uuid
    `;
  }

  async markFailed(id: string, error: string) {
    await this.prisma.$executeRaw`
      UPDATE ai_documents SET
        status           = 'failed',
        processing_error = ${error},
        failed_at        = NOW(),
        updated_at       = NOW()
      WHERE id = ${id}::uuid
    `;
  }
}
