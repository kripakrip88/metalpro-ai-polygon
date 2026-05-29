# MetalPro — Контекст и план: Иерархический перенос позиций из письма в ERP

## Репозитории
- **metalpro-ai-polygon** — AI-модуль: OCR, извлечение через Claude API
- **erp-metal** — основная ERP: заказы, BOM, материалы, КП

---

## 1. Конкретная проблема (пример из жизни)

Приходит письмо от snabcem@gmail.com с заявкой:

```
Консоль кабельного короба К-1 6466/03.0028-Н-ИС-4  325-09Г2С-12  27 шт
Консоль кабельного короба К-2 6466/03.0028-П-ИС-4  325-09Г2С-12  4 шт
Кронштейн ШП-59-2014-24-01  325-09Г2С-12  84 шт
Перегородка ЕИУС.668414.001.030 СБ  *Ст3пс5  72 шт
Секция концевая ЕИУС.668414.001.020-05  *Ст3пс5  2 шт
Секция пролётная ЕИУС.668414.001.010-05  *Ст3пс5  27 шт
```

**Что делает система сейчас:**
Нажимаю "КП из письма" → система создаёт МАТЕРИАЛЫ в BOM основного узла.
Каждая строка становится строкой закупки: "Консоль К-1" как материал, 09Г2С как его марка.

**Что это на самом деле:**
Каждая строка — это **изделие (Assembly/Узел)**, которое нужно **изготовить**.
"09Г2С" — это марка стали конструкции, не закупочная позиция.

Правильная структура в ERP:
```
RFQ (КП)
  ├── Узел: Консоль кабельного короба К-1 (6466/03.0028-Н-ИС-4) — 27 шт
  │     └── BOM: [труба, лист, уголок, крепёж...] ← из PDF/Excel/фото
  ├── Узел: Консоль кабельного короба К-2 — 4 шт
  │     └── BOM: [...]
  ├── Узел: Кронштейн ШП-59-2014-24-01 — 84 шт
  │     └── BOM: [...]
  └── ...
```

---

## 2. Откуда берётся BOM

BOM каждого узла может прийти из **разных источников** — всегда отдельным документом:

| Источник | Формат | Обработка |
|----------|--------|-----------|
| Спецификация к чертежу | PDF | OCR → AI extraction |
| Таблица состава изделия | Excel/xlsx | парсинг таблицы → AI |
| Фото чертежа / таблицы | JPG/PNG | OCR (Tesseract) → AI |
| Сканированный документ | PDF (скан) | OCR → AI |

**Важно:** BOM-документ — это ВСЕГДА отдельный документ от письма с заявкой.
Письмо содержит только список изделий + количества.

---

## 3. Правильный двухэтапный флоу

```
ЭТАП 1 — Письмо с заявкой
────────────────────────────────────────────────────────
Email (body / attachment)
    ↓ OCR (существующий pipeline)
    ↓ Claude: Assembly Extraction
        Промпт: "найди изделия верхнего уровня — что нужно изготовить"
    ↓ extracted_assembly[] сохранены в БД
    ↓ erp-metal: GET /bom-draft → создать узлы-заглушки в RFQ
        Узел "Консоль К-1" — количество 27 — BOM пустой
        Узел "Перегородка ЕИУС..." — количество 72 — BOM пустой


ЭТАП 2 — BOM-документ (PDF/Excel/Фото)
────────────────────────────────────────────────────────
Пользователь прикладывает документ к узлу (или к RFQ целиком)
    ↓ Upload → OCR (существующий pipeline, тот же Tesseract)
    ↓ Claude: BOM Extraction для каждого узла
        Промпт: "для узла {name} {designation} — извлеки состав"
    ↓ extracted_bom + extracted_bom_item[] сохранены в БД
    ↓ erp-metal: GET /bom-draft → BOM теперь заполнен
        Узел "Консоль К-1":
            Поз.1: Труба профильная 60×40×4 09Г2С, 2400мм, 6 шт
            Поз.2: Лист 8мм, 300×200, 2 шт
            ...
    ↓ Stage 3: нормализация → матч с materials_dictionary
    ↓ Пользователь подтверждает / корректирует
```

---

## 4. Что уже сделано в metalpro-ai-polygon

### Готово (ветка `claude/extraction-pipeline-hierarchy-vj5ZJ`):

| Компонент | Файл | Статус |
|-----------|------|--------|
| DB миграция (5 новых таблиц) | `database/migrations/005_...sql` | ✅ |
| Prisma schema (5 моделей) | `backend/prisma/schema.prisma` | ✅ |
| Репозитории с Prisma | `repositories/extracted-*.ts` | ✅ |
| AssemblyExtractionPromptBuilder | `services/assembly-extraction-prompt-builder.service.ts` | ✅ |
| BomExtractionPromptBuilder | `services/bom-extraction-prompt-builder.service.ts` | ✅ |
| AssemblyExtractorService | `services/assembly-extractor.service.ts` | ✅ |
| BomExtractorService | `services/bom-extractor.service.ts` | ✅ |
| HierarchicalExtractionOrchestrator | `services/hierarchical-extraction-orchestrator.service.ts` | ✅ |
| GET /api/ai-bom/document/:id/bom-draft | `ai-bom.controller.ts` | ✅ |
| Feature flag ENABLE_HIERARCHICAL_EXTRACTION | env var | ✅ |

### Чего НЕ хватает в metalpro-ai-polygon:

**Проблема архитектуры текущего orchestrator:**
`HierarchicalExtractionOrchestrator.extract(documentId, ocrText)` запускает
Assembly extraction И BOM extraction из ОДНОГО документа.
Но BOM-документ — это всегда ОТДЕЛЬНЫЙ файл, загружаемый позже.

**Нужно разделить на два независимых триггера:**

1. `POST /api/ai-bom/document/:id/extract-assemblies`
   - Запускает только Assembly extraction для этого документа
   - Сохраняет extracted_assembly[]
   - Вызывается автоматически после OCR completion (если ENABLE_HIERARCHICAL_EXTRACTION=true)

2. `POST /api/ai-bom/document/:id/extract-bom?assemblyId=...`
   - Запускает BOM extraction из этого документа для указанного assembly
   - Сохраняет extracted_bom + extracted_bom_item[]
   - Вызывается: либо вручную пользователем, либо erp-metal после upload BOM-документа

---

## 5. Что нужно изменить в erp-metal

### 5.1 Обработчик "КП из письма"

**Сейчас:** получает плоский список из ai_extraction_items → создаёт материалы.

**Должно быть:** 
1. Запросить `GET /api/ai-bom/document/{documentId}/bom-draft`
2. Получить `assemblies[]`
3. Для каждого assembly — создать **узел (Node)** в RFQ, а не материал
4. Узел создаётся как заглушка: название + количество + марка стали из письма
5. BOM узла пока пустой

### 5.2 UI: прикрепить BOM-документ к узлу

На странице узла (Node detail) — кнопка "Загрузить спецификацию".
Поддерживаемые форматы: PDF, Excel, JPG, PNG.

При загрузке:
1. Файл отправляется в `POST /api/ai-bom/upload` (metalpro-ai-polygon)
2. Запускается OCR pipeline
3. По завершении OCR — `POST /api/ai-bom/document/:id/extract-bom?assemblyId={id}`
4. Результат: BOM заполнен в extracted_bom_item[]
5. erp-metal получает BOM через `GET /bom-draft` и показывает позиции

### 5.3 Интеграционный контракт между репо

```
metalpro-ai-polygon                    erp-metal
────────────────────────────────────────────────────────
GET /bom-draft                 ←───    "КП из письма"
                               ───→    создать узлы

POST /upload (bom doc)         ←───    "Загрузить спецификацию"
POST /extract-bom?assemblyId   ←───    после OCR completion callback

GET /bom-draft (populated)     ←───    автоматически / по кнопке
                               ───→    заполнить BOM узла
```

---

## 6. Порядок реализации (шаги)

### Шаг A — metalpro-ai-polygon: разделить orchestrator

Сейчас `HierarchicalExtractionOrchestrator.extract()` — монолит.
Нужно:

```typescript
// Шаг A1: только Assembly extraction (вызывается после email OCR)
POST /api/ai-bom/document/:id/extract-assemblies
→ AssemblyExtractorService.extract(documentId, ocrText)
→ сохранить extracted_assembly[]
→ вернуть { assemblies: [...] }

// Шаг A2: только BOM extraction для конкретного assembly
POST /api/ai-bom/document/:id/extract-bom
body: { assemblyId: string }
→ BomExtractorService.extractForAssembly(documentId, ocrText, assembly)
→ сохранить extracted_bom + extracted_bom_item[]
→ вернуть { bom: { items: [...] } }
```

HierarchicalExtractionOrchestrator — оставить как есть (для случая когда
всё в одном документе — email с вложенной спецификацией).

### Шаг B — erp-metal: "КП из письма" создаёт узлы

В обработчике создания КП из email:
- Вместо `materials[]` → создать `nodes[]` (Assembly stubs)
- Каждый узел: название из assembly.name, обозначение из assembly.designation,
  количество из assembly.quantity, марка стали из письма → в поле `notes` или `steel_grade`
- BOM узла пустой (materialRows = [])

### Шаг C — erp-metal: UI для загрузки BOM-документа

На странице узла:
- Кнопка "Загрузить спецификацию" (принимает PDF, Excel, JPG, PNG)
- Upload → metalpro-ai-polygon → OCR → BOM extraction → результат в BOM узла

### Шаг D — erp-metal: получить BOM и заполнить узел

После BOM extraction:
- GET /bom-draft → bom.items[]
- Создать materialRows в узле из bom_items
- Показать предложения нормализации (match_confidence)
- Пользователь подтверждает / корректирует

---

## 7. Ограничения и решения

**OCR для фото/скана:**
- Tesseract справляется с печатным текстом (PDF, Excel → текст)
- Для рукописных таблиц или плохих фото — confidence будет низкий
- Решение: показывать confidence score + возможность ручного ввода

**Один BOM-документ, несколько узлов:**
- Спецификация может содержать BOM сразу для нескольких изделий
- BomExtractorService уже принимает `assembly` контекст в промпте
- Запускать отдельный вызов Claude для каждого assembly из одного документа

**Excel без OCR:**
- Excel → не нужен Tesseract, нужен парсер xlsx
- В metalpro-ai-polygon сейчас нет Excel парсера
- Можно: конвертировать Excel → CSV → передать как текст в Claude
- Добавить как отдельную ветку в OCR preprocessing

---

## 8. Текущий статус БД (metalpro-ai-polygon)

```sql
-- Существующие (legacy, не трогаем):
ai_documents              -- загруженные файлы
ai_extraction_runs        -- запуски извлечения
ai_extraction_items       -- плоский список (старый pipeline)
ai_extraction_telemetry   -- телеметрия

-- Новые (Stage 5, ветка claude/extraction-pipeline-hierarchy-vj5ZJ):
extracted_assembly        -- изделия из письма
extracted_bom             -- спецификация (1:1 к assembly)
extracted_bom_item        -- позиции спецификации
extracted_material        -- нормализованные материалы
extracted_coating         -- покрытия
```

---

## Итог

Основная идея: строки из письма — это **изделия для изготовления**, а не материалы.
BOM каждого изделия приходит отдельно (PDF/Excel/Фото).
Система должна поддерживать двухэтапный флоу: сначала список изделий → потом BOM каждого изделия.

Приоритет реализации: Шаг A (metalpro-ai-polygon) → Шаг B (erp-metal) → Шаг C → Шаг D.
