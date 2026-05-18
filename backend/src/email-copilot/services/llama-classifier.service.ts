import { Injectable, Logger } from "@nestjs/common";
import { ParsedEmail, EmailAnalysis } from "../types/email.types";

@Injectable()
export class LlamaClassifierService {
  private readonly logger = new Logger(LlamaClassifierService.name);

  async classify(email: ParsedEmail): Promise<EmailAnalysis> {
    const ollamaUrl = process.env.OLLAMA_URL ?? "http://ollama:11434";

    const prompt = `Classify this business email. Reply ONLY with valid JSON, no explanations.

From: ${email.from}
Subject: ${email.subject}
Body (first 500 chars): ${email.bodyText.slice(0, 500)}

Reply with:
{"intent":"RFQ|ORDER|QUESTION|COMPLAINT|CLARIFICATION|SPAM|OTHER","priority":"critical|urgent|normal|low","confidence":0.0,"summary":"2 sentence summary in Russian"}`;

    try {
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "llama3.2:8b", prompt, stream: false, options: { temperature: 0, num_predict: 200 } }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
      const body = await response.json() as any;
      const parsed = JSON.parse(body.response ?? "{}");

      this.logger.log(`Email classified via Llama: ${parsed.intent}`);

      return {
        intent:     parsed.intent    ?? "OTHER",
        priority:   parsed.priority  ?? "normal",
        confidence: parsed.confidence ?? 0.5,
        summary:    parsed.summary   ?? "",
        extracted:  {},
        drafts: [{
          strategy: "Подтверждение получения",
          body: `Добрый день!\n\nСпасибо за ваше письмо. Мы его получили и скоро свяжемся с вами.\n\nС уважением,\nМеталлПро`,
        }],
        suggestRfq: parsed.intent === "RFQ",
        modelUsed: "llama",
      };
    } catch (err) {
      this.logger.warn(`Llama classify failed: ${(err as Error).message}`);
      return {
        intent: "OTHER", priority: "normal", confidence: 0,
        summary: "Классификация недоступна.", extracted: {},
        drafts: [], suggestRfq: false, modelUsed: "llama",
      };
    }
  }
}
