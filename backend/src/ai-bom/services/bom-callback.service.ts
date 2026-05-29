import { Injectable, Logger } from "@nestjs/common";

export interface BomExtractedPayload {
  documentId: string;
  assemblyId: string;
  erpAssemblyId?: string;
  rfqId?: string;
  status: "completed" | "failed";
  items?: Array<{
    position?: number;
    name: string;
    profileType: string;
    steelGrade?: string;
    gost?: string;
    lengthMm?: number;
    quantity: number;
    unit: string;
    massTotalKg?: number;
    confidence?: number;
  }>;
  error?: string;
}

@Injectable()
export class BomCallbackService {
  private readonly logger = new Logger(BomCallbackService.name);

  async notify(payload: BomExtractedPayload): Promise<void> {
    const baseUrl = process.env.ERP_METAL_URL;
    if (!baseUrl) {
      this.logger.warn("ERP_METAL_URL not set — BOM extracted callback skipped");
      return;
    }
    try {
      const res = await fetch(`${baseUrl}/internal/bom-extracted`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        this.logger.error(`BOM callback HTTP ${res.status} for document ${payload.documentId}`);
      } else {
        this.logger.log(`BOM callback sent: document ${payload.documentId}, assembly ${payload.assemblyId}, status ${payload.status}`);
      }
    } catch (err) {
      this.logger.error(`BOM callback network error: ${(err as Error).message}`);
    }
  }
}
