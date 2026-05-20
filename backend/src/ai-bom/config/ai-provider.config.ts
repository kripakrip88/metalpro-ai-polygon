export const AI_MODELS = {
  claude:     process.env.AI_MODEL_CLAUDE ?? "claude-sonnet-4-20250514",
  claudeFast: process.env.AI_MODEL_FAST   ?? "claude-haiku-4-5-20251001",
  llama:      process.env.AI_MODEL_LOCAL  ?? "llama3.2:8b",
} as const;

export const AI_RETRY = {
  maxRetries:      3,
  baseDelayMs:     2000,
  timeoutMs:       60_000,
} as const;

export const CLAUDE_API_URL =
  `${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`;
