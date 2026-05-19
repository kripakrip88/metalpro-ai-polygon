import { Injectable, Logger } from "@nestjs/common";

export interface EmailAnalysis {
  intent: string;
  priority: string;
  confidence: number;
  summary: string;
  extracted: {
    company?: string;
    contact?: string;
    deadline?: string;
    currency?: string;
    items?: Array<{ name: string; quantity?: number; unit?: string; material?: string }>;
  };
  drafts: Array<{ strategy: string; body: string }>;
  suggestRfq: boolean;
}

@Injectable()
export class AiAnalysisService {
  private readonly logger = new Logger(AiAnalysisService.name);
  private readonly apiUrl = `${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`;

  async analyzeEmail(subject: string, bodyText: string, from: string): Promise<EmailAnalysis> {
    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          temperature: 0,
          messages: [{ role: "user", content: this.buildPrompt(subject, bodyText, from) }],
        }),
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json() as any;
      const text = data.content?.find((c: any) => c.type === "text")?.text ?? "";
      return this.parseResponse(text);
    } catch (err: any) {
      this.logger.error(`AI analysis failed: ${err.message}`);
      return this.fallback();
    }
  }

  private buildPrompt(subject: string, body: string, from: string): string {
    return `Проанализируй входящее письмо клиента металлообрабатывающей компании.

От: ${from}
Тема: ${subject}
Текст: ${body.slice(0, 3000)}

Верни ТОЛЬКО валидный JSON (без markdown):
{
  "intent": "RFQ"|"ORDER"|"QUESTION"|"COMPLAINT"|"SPAM"|"OTHER",
  "priority": "critical"|"urgent"|"normal"|"low",
  "confidence": 0.95,
  "summary": "Резюме на русском 2-3 предложения",
  "extracted": {
    "company": "название или null",
    "contact": "имя или null",
    "deadline": "срок или null",
    "currency": "RUB|USD|EUR или null",
    "items": [{"name": "...", "quantity": 10, "unit": "шт", "material": "сталь"}]
  },
  "drafts": [
    {"strategy": "деловой", "body": "текст ответа"},
    {"strategy": "краткий", "body": "текст ответа"},
    {"strategy": "уточняющий", "body": "текст ответа"}
  ],
  "suggestRfq": true
}`;
  }

  private parseResponse(text: string): EmailAnalysis {
    try {
      const clean = text.replace(/^```json\s*/m, "").replace(/```\s*$/m, "").trim();
      return JSON.parse(clean);
    } catch {
      return this.fallback();
    }
  }

  private fallback(): EmailAnalysis {
    return {
      intent: "OTHER", priority: "normal", confidence: 0,
      summary: "Автоматический анализ недоступен",
      extracted: {},
      drafts: [{ strategy: "стандартный", body: "Добрый день!\n\nСпасибо за обращение. Рассмотрим ваш запрос и свяжемся с вами.\n\nС уважением,\nМеталлПро" }],
      suggestRfq: false,
    };
  }
}