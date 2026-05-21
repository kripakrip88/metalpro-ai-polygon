import { Injectable, Logger } from "@nestjs/common";
import { AI_MODELS, AI_RETRY } from "../config/ai-provider.config";

const OLLAMA_TIMEOUT_MS = 120_000;

export type LlamaInferenceResult =
  | { success: true; rawResponse: string; model: string; tokensInput: number; tokensOutput: number; durationMs: number; memoryUsageMb: number | null; attempts: number }
  | { success: false; error: string; errorType: "timeout" | "oom" | "model_not_found" | "network" | "unknown"; durationMs: number };

@Injectable()
export class LlamaInferenceProvider {
  private readonly logger    = new Logger(LlamaInferenceProvider.name);
  private readonly ollamaUrl = process.env.OLLAMA_URL ?? "http://ollama:11434";

  async infer(input: { systemPrompt: string; userPrompt: string; maxTokens?: number; temperature?: number }): Promise<LlamaInferenceResult> {
    let totalDurationMs = 0;
    let lastResult: LlamaInferenceResult | null = null;

    for (let attempt = 1; attempt <= AI_RETRY.maxRetries; attempt++) {
      const result = await this.inferOnce(input);
      totalDurationMs += result.durationMs;

      if (result.success) {
        return { ...result, durationMs: totalDurationMs, attempts: attempt };
      } else {
        lastResult = { ...result, durationMs: totalDurationMs };
        this.logger.warn(`Llama attempt ${attempt}/${AI_RETRY.maxRetries} failed (${result.errorType}): ${result.error}`);

        if (result.errorType === "model_not_found") break;

        if (attempt < AI_RETRY.maxRetries) {
          const delayMs = AI_RETRY.baseDelayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    return lastResult!;
  }

  private async inferOnce(input: { systemPrompt: string; userPrompt: string; maxTokens?: number; temperature?: number }): Promise<LlamaInferenceResult> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: AI_MODELS.llama,
          stream: false,
          options: { temperature: input.temperature ?? 0, num_predict: input.maxTokens ?? 4096 },
          messages: [
            { role: "system", content: input.systemPrompt },
            { role: "user",   content: input.userPrompt },
          ],
        }),
      });
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;

      if (!response.ok) {
        const body = await response.text();
        const errorType = body.includes("model not found") ? "model_not_found"
          : body.toLowerCase().includes("out of memory") ? "oom"
          : "unknown";
        return { success: false, error: body.slice(0, 500), errorType, durationMs };
      }

      const body = await response.json() as any;
      const rawResponse = body.message?.content ?? "";
      if (!rawResponse) return { success: false, error: "Empty response from Ollama", errorType: "unknown", durationMs };

      return { success: true, rawResponse, model: AI_MODELS.llama, tokensInput: body.prompt_eval_count ?? 0, tokensOutput: body.eval_count ?? 0, durationMs, memoryUsageMb: null, attempts: 1 };
    } catch (err) {
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;
      if ((err as Error).name === "AbortError") return { success: false, error: "Inference timeout", errorType: "timeout", durationMs };
      return { success: false, error: (err as Error).message, errorType: "network", durationMs };
    }
  }
}
