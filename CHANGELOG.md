# Changelog — MetalPro

> Этот файл ведёт Claude Code после каждого значимого изменения.
> Формат: дата, репозиторий, тип, описание, зачем сделано.
> Лежит в ОБОИХ репозиториях.

---

## Формат записи

```
## YYYY-MM-DD

### erp-metal
- [feat] название — зачем сделано
- [fix] название — что было не так
- [refactor] название — мотивация

### metalpro-ai-polygon
- [feat] название — зачем сделано
```

Типы: `feat` / `fix` / `refactor` / `docs` / `migration` / `config` / `breaking`

---

## 2026-05-30 (deploy fixes)

### metalpro-ai-polygon
- [fix] startup-migrations.ts — больше не крашит приложение при ошибке миграции (`throw err` → `logger.warn`); app стартует всегда
- [fix] main.ts — увеличен лимит body parser до 50MB (`json + urlencoded`); устранена ошибка HTTP 413 при загрузке файлов
- [feat] GET /health — endpoint проверки работоспособности сервиса (`{ status: "ok", timestamp }`)
- [config] .github/workflows/deploy.yml — GitHub Actions workflow для авто-деплоя через SSH при пуше в main

## 2026-05-30 (Step C v2 — jobId)

### metalpro-ai-polygon
- [feat] BomExtractionJob Prisma model + migration 007_bom_extraction_jobs.sql — отдельная таблица для tracking upload-and-extract-bom jobs
- [feat] BomExtractionJobRepository — create / findById / complete / fail через Prisma
- [feat] POST /api/ai-bom/upload-and-extract-bom — теперь возвращает { jobId, status: "processing" } (было documentId)
- [feat] GET /api/ai-bom/extraction-status/:jobId — polling endpoint: processing / completed { itemsCreated } / failed { error }
- [feat] runAllContextualBomExtractions — подсчёт totalItems, обновляет job.status после завершения всех assemblies
- [feat] runContextualBomExtraction — теперь возвращает number (count items) вместо void
- [refactor] uploadAndExtractBom — extraction_context включает jobId для обратного маппинга
- [feat] startup-migrations.ts — добавлена миграция 007 как belt-and-suspenders

## 2026-05-29 (Step C)

### metalpro-ai-polygon
- [migration] 006_extraction_context.sql — добавлена колонка extraction_context JSONB в ai_documents для хранения контекста erp-metal assemblies
- [feat] POST /api/ai-bom/upload-and-extract-bom — принимает file + rfqId + assemblies (JSON), сохраняет extraction_context, запускает OCR
- [feat] StorageService — добавлена поддержка Excel (.xlsx, .xls), JPG, PNG форматов (ранее только PDF)
- [feat] DocumentRepository — поддержка extractionContext (create + findById)
- [feat] BomCallbackService — добавлены erpAssemblyId и rfqId в payload (для маппинга в erp-metal)
- [feat] handleOcrCallback — ветвление: если extraction_context есть → targeted BOM extraction для каждого assembly из контекста; иначе → legacy pipeline без изменений
- [feat] runAllContextualBomExtractions + runContextualBomExtraction — полный pipeline для upload-and-extract-bom: создаёт ExtractedAssembly, запускает BomExtractor, отправляет callback с erpAssemblyId

## 2026-05-29

### metalpro-ai-polygon
- [feat] GET /api/ai-bom/document/:id/status — статус документа для polling erp-metal (фазы: uploading→ocr→ocr_done→extracting→completed/error)
- [feat] POST /api/ai-bom/document/:id/extract-assemblies — синхронное извлечение узлов из письма (3-8 сек, erp-metal ждёт ответ)
- [feat] POST /api/ai-bom/document/:id/extract-bom — асинхронный запуск BOM extraction (возврат 202, callback в erp-metal POST /internal/bom-extracted по завершении)
- [feat] BomCallbackService — webhook-уведомление erp-metal о завершении BOM extraction (completed/failed + items[])
- [feat] DocumentRepository реализован через prisma.$queryRaw — все методы (create, findById, findByChecksum, findAll, updateStatus, saveOcrResult, markFailed, incrementRetry, resetForReprocess, updateLlamaStatus)
- [fix] Весь OCR→AI pipeline теперь рабочий end-to-end (DocumentRepository больше не стаб)

## 2026-05-28

### metalpro-ai-polygon
- [migration] 005_stage5_hierarchical_extraction.sql — 5 новых таблиц: extracted_assembly, extracted_bom, extracted_bom_item, extracted_material, extracted_coating. Additive, старые таблицы не тронуты
- [feat] AssemblyExtractionPromptBuilder — промпт только на изделия верхнего уровня, без материалов
- [feat] BomExtractionPromptBuilder — промпт на BOM для конкретного Assembly
- [feat] AssemblyExtractorService, BomExtractorService — двухэтапная иерархическая экстракция
- [feat] HierarchicalExtractionOrchestratorService — Assembly → BOM→ BOMItem pipeline, управляется через ENABLE_HIERARCHICAL_EXTRACTION
- [feat] GET /api/ai-bom/document/:id/bom-draft — endpoint для иерархического BOM в ERP-формате
- [feat] Feature flag ENABLE_HIERARCHICAL_EXTRACTION — новый pipeline запускается параллельно со старым только на staging, prod не затронут
- [feat] Prisma schema — добавлены 5 моделей (ExtractedCoating, ExtractedAssembly, ExtractedBom, ExtractedBomItem, ExtractedMaterial); prisma db push при деплое создаёт таблицы автоматически
- [feat] Репозитории подключены к Prisma (реализованы все 5 вместо стабов); Decimal→number конвертация при чтении
- [fix] AiBomModule добавлен в AppModule — все /api/ai-bom/* эндпоинты теперь активны
- [fix] zod добавлен в package.json dependencies (был missing, схемы не компилировались)

## 2025-05-27

### Документация
- [docs] Создан CONTEXT.md — единый источник правды о состоянии обоих репо
- [docs] Создан CHANGELOG.md — лог изменений для синхронизации claude.ai и Claude Code
- [docs] Создан CLAUDE_ADDON.md — дополнение к CLAUDE.md с правилами синхронизации
- [fix] WORKFLOW.md — staging порт исправлен с 8080 на 3000
- [config] Сервер привязан к домену (обновить домен в CONTEXT.md)
