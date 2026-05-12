# MetalPro AI Polygon

AI-модуль для ERP/MES системы металлоконструкций.

## Стек
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- AI: Claude API + Llama (Ollama)
- OCR: PaddleOCR
- Orchestration: n8n

## Этапы реализации
- Stage 1: Infrastructure + DB schema
- Stage 2: Upload + Async OCR pipeline
- Stage 3: Claude Extraction (3-layer persistence)
- Stage 4: Llama Parallel Extraction + Telemetry

## Запуск
```bash
cp .env.example .env
# заполни .env
docker-compose up -d
```

