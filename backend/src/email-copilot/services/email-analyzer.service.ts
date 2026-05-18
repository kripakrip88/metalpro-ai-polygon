import { Injectable, Logger } from "@nestjs/common";
import { ParsedEmail, EmailAnalysis, InteractionPayload } from "../types/email.types";

const CLAUDE_MODEL   = "claude-sonnet-4-6";
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `Ты — AI-ассистент менеджера металлообрабатывающего завода МеталлПро.
Твоя задача — анализировать входящие письма от клиентов и помогать менеджеру отвечать.
Отвечай ТОЛЬКО в JSON, без markdown, без пояснений за пределами JSON.`;

// Strip potential prompt injection patterns before sending to Claude
function sanitizeForPrompt(text: string): string {
  return text
    .replace(/ignore\s+(previous|all)\s+instructions?/gi, "[filtered]")
    .replace(/\[INST\]|\[\/INST\]|<\|.*?\|>/g, "[filtered]")
    .replace(/system:\s*you are/gi, "[filtered]")
    .slice(0, 8000);
}

@Injectable()
export class EmailAnalyzerService {
  private readonly logger = new Logger(EmailAnalyzerService.name);

  async analyze(email: ParsedEmail, interactionHistory: InteractionPayload[]): Promise<EmailAnalysis> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      this.logger.warn("ANTHROPIC_API_KEY not set — returning fallback analysis");
      return this.fallback(email);
    }

    const historyText = interactionHistory.length > 0
      ? interactionHistory.map(i => `[${i.type}/${i.direction}] ${i.subject ?? ""}: ${(i.body ?? "").slice(0, 200)}`).join("\n")
      : "История взаимодействий отсутствует.";

    const userPrompt = `
От: ${sanitizeForPrompt(email.from)}
Тема: ${sanitizeForPrompt(email.subject)}
Дата: ${email.receivedAt.toISOString()}
Вложений: ${email.attachments.length}

Текст письма:
${sanitizeForPrompt(email.bodyText)}

История взаимодействий с клиентом (последние 5):
${sanitizeForPrompt(historyText)}

Выполни:
1. Классифицируй намерение (intent): RFQ | ORDER | QUESTION | COMPLAINT | CLARIFICATION | SPAM | OTHER
2. Определи приоритет (priority): critical | urgent | normal | low
3. Извлеки сущности (extracted): компания, контакт, телефон, email, позиции (name/quantity/unit/material), дедлайн, валюта
4. Напиши краткое резюме (summary) на русском, 2-3 предложения
5. Составь 3 варианта ответа (drafts) с разными стратегиями:
   - "Быстрое подтверждение" — короткий вежливый ответ, подтверждаем получение
   - "Детальный ответ" — развёрнутый ответ с уточнением деталей
   - "Запрос уточнений" — просим уточнить технические требования
6. Рекомендуй создание заявки на КП (suggest_rfq: true/false)

Ответь строго в JSON:
{
  "intent": "...",
  "priority": "...",
  "confidence": 0.0,
  "summary": "...",
  "extracted": {
    "company": null,
    "contact": null,
    "phone": null,
    "email": null,
    "items": [],
    "deadline": null,
    "currency": null,
    "deliveryTerms": null
  },
  "drafts": [
    {"strategy": "Быстрое подтверждение", "body": "..."},
    {"strategy": "Детальный ответ", "body": "..."},
    {"strategy": "Запрос уточнений", "body": "..."}
  ],
  "suggest_rfq": false
}`;

    try {
      const startedAt = Date.now();
      const response = await fetch(CLAUDE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 2048,
          temperature: 0.3,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      const durationMs = Date.now() - startedAt;
      if (!response.ok) {
        this.logger.error(`Claude API error: HTTP ${response.status}`);
        return this.fallback(email);
      }

      const body = await response.json() as any;
      const textBlock = body.content?.find((c: any) => c.type === "text");
      if (!textBlock?.text) return this.fallback(email);

      const parsed = JSON.parse(textBlock.text);
      this.logger.log(`Email analyzed via Claude in ${durationMs}ms: ${parsed.intent} (${parsed.priority})`);

      return {
        intent:     parsed.intent     ?? "OTHER",
        priority:   parsed.priority   ?? "normal",
        confidence: parsed.confidence ?? 0.7,
        summary:    parsed.summary    ?? "",
        extracted:  parsed.extracted  ?? {},
        drafts:     parsed.drafts     ?? [],
        suggestRfq: parsed.suggest_rfq ?? false,
        modelUsed:  "claude",
      };
    } catch (err) {
      this.logger.error(`Analysis error: ${(err as Error).message}`);
      return this.fallback(email);
    }
  }

  private fallback(email: ParsedEmail): EmailAnalysis {
    return {
      intent:     "OTHER",
      priority:   "normal",
      confidence: 0,
      summary:    "AI анализ недоступен. Требуется ручная обработка.",
      extracted:  {},
      drafts: [{
        strategy: "Подтверждение получения",
        body: `Добрый день!\n\nСпасибо за ваше обращение. Мы получили ваше письмо и рассмотрим его в ближайшее время.\n\nС уважением,\nМеталлПро`,
      }],
      suggestRfq: false,
      modelUsed:  "claude",
    };
  }
}
