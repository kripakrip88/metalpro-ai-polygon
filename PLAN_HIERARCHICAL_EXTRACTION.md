# План — Hierarchical Extraction Pipeline

## Суть проблемы

Текущая модель: `Document → ai_extraction_items[]` (плоский список).
AI смешивает в одном массиве Assembly, BOM позиции, материалы, покрытия — разные доменные сущности.

## Новая доменная модель

```
Assembly
  └── BOM (1:1)
        └── BOMItem[]
              └── Material (после нормализации)
              └── Coating (опционально)
```

---

## Шаг 1 — Миграция БД (5 новых таблиц)

Файл: `database/migrations/005_stage5_hierarchical_extraction.sql`

- `extracted_assembly` — изделие (название, обозначение, количество, источник)
- `extracted_bom` — спецификация (1:1 к assembly)
- `extracted_bom_item` — позиция (профиль, марка, ГОСТ, длина, масса, покрытие)
- `extracted_material` — результат нормализации (матч в materials_dictionary)
- `extracted_coating` — покрытие/ЛКМ

Старые таблицы (`ai_extraction_items` и др.) — **не трогаем**, остаются как legacy.

---

## Шаг 2 — Zod schemas

- `assembly-extraction.schema.ts` — валидация ответа AI на Assembly
- `bom-extraction.schema.ts` — валидация ответа AI на BOM

---

## Шаг 3 — Новые Prompt Builders

- `AssemblyExtractionPromptBuilder` — промпт: "найти только изделия верхнего уровня"
- `BomExtractionPromptBuilder` — промпт: "для assembly {name} извлечь состав"

Существующий `ClaudePromptBuilderService` — **сохраняем** (используется Llama benchmark).

---

## Шаг 4 — Новые Repositories

- `ExtractedAssemblyRepository`
- `ExtractedBomRepository`
- `ExtractedBomItemRepository`
- `ExtractedMaterialRepository`
- `ExtractedCoatingRepository`

---

## Шаг 5 — Новые Extractor Services

- `AssemblyExtractorService` — Claude → assembly[]
- `BomExtractorService` — Claude → bom + bom_items[] для каждого assembly

---

## Шаг 6 — HierarchicalExtractionOrchestrator

```typescript
async extract(documentId) {
  const assemblies = await this.assemblyExtractor.extract(documentId);
  for (const assembly of assemblies) {
    await this.bomExtractor.extractForAssembly(documentId, assembly);
  }
}
```

Запускается **параллельно** со старым пайплайном — для сравнения результатов.

---

## Шаг 7 — Новый API endpoint

`GET /api/ai-bom/document/:id/bom-draft`

```json
{
  "assemblies": [{
    "name": "Лестница Л1",
    "quantity": 2,
    "bom": {
      "items": [{
        "position": 1,
        "name": "Труба профильная 80×80×4",
        "quantity": 6,
        "length_mm": 2400,
        "material": { "erp_id": "...", "match_confidence": 0.95 }
      }]
    }
  }]
}
```

---

## Что НЕ меняется

| Компонент | Статус |
|-----------|--------|
| OCR pipeline | Без изменений |
| ClaudePromptBuilderService | Сохраняем |
| ExtractionTelemetryService | Без изменений |
| Старый ExtractionOrchestrator | Сохраняем, параллельный запуск |
| Llama benchmark | Без изменений |
| ai_extraction_items | Legacy, не трогаем |

---

## Принцип миграции: additive

Новые таблицы добавляются рядом. Ничего не ломается. Старый pipeline продолжает работать.
