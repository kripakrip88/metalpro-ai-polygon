# Stage 4 Review — Llama Parallel Extraction

## Architecture
- Claude = primary (determines document.status)
- Llama = benchmark (failure = telemetry only, document.status unchanged)
- Promise.allSettled — independent failure domains
- LlamaInferenceProvider — Ollama abstraction (swap to vLLM/GPU without changing business logic)
- ExtractionTelemetryService — append-only observability, fire-and-forget writes
- Identical input to both models (same ClaudePromptBuilderService, temperature=0)
- Same schema validator (safeParseClaudeResponse) for both models
- No ranking, voting, or ensemble logic

## Next: Stage 5 — Normalization Layer
- MaterialNormalizationService
- Alias matching against materials_dictionary
- Supplier-aware mappings
- User correction feedback loops
- Output: user-facing draft BOM (ai_extraction_results)
