import { Injectable, Logger } from "@nestjs/common";
import { CrmCustomer, CrmContact, InteractionPayload } from "../types/email.types";

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = (process.env.ERP_METAL_URL ?? "http://erp-metal:3000").replace(/\/$/, "");
  }

  private get authHeader(): Record<string, string> {
    const token = process.env.ERP_METAL_API_TOKEN;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async findCustomerByEmail(email: string): Promise<CrmCustomer | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/customers?email=${encodeURIComponent(email)}`, {
        headers: this.authHeader,
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const list = await res.json() as any[];
      return list[0] ?? null;
    } catch (err) {
      this.logger.warn(`CRM lookup failed for ${email}: ${(err as Error).message}`);
      return null;
    }
  }

  async getInteractionHistory(customerId: string, limit: number): Promise<InteractionPayload[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/customers/${customerId}/interactions?limit=${limit}`, {
        headers: this.authHeader,
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      return (await res.json()) as InteractionPayload[];
    } catch (err) {
      this.logger.warn(`Interaction history fetch failed: ${(err as Error).message}`);
      return [];
    }
  }

  async saveInteraction(payload: InteractionPayload): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeader },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`CRM saveInteraction HTTP ${res.status}`);
  }

  async createOrder(data: { customerName: string; title: string; description?: string }): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeader },
      body: JSON.stringify({
        orderNumber: `RFQ-${Date.now()}`,
        customerName: data.customerName,
        title: data.title,
        description: data.description ?? "",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Create order HTTP ${res.status}`);
    return res.json();
  }
}
