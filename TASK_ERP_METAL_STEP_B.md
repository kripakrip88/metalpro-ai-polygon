# Задача для erp-metal: "КП из письма" → создавать узлы, а не материалы

## Контекст

В erp-metal есть кнопка "КП из письма" (email-inbox.html).
Сейчас при её нажатии система создаёт плоский список **материалов** в BOM основного узла.

Это неправильно. Каждая строка из письма (например "Консоль кабельного короба К-1 6466/03.0028-Н-ИС-4 — 27 шт") — это **изделие (Assembly/Узел)**, которое нужно изготовить. "09Г2С" рядом — марка стали конструкции, не закупочная позиция.

Правильная структура в ERP после нажатия "КП из письма":
```
RFQ
  ├── Узел: Консоль кабельного короба К-1 (6466/03.0028-Н-ИС-4) — 27 шт  ← Assembly
  ├── Узел: Консоль кабельного короба К-2 (6466/03.0028-П-ИС-4) — 4 шт   ← Assembly
  ├── Узел: Кронштейн ШП-59-2014-24-01 — 84 шт                            ← Assembly
  └── ...
```

BOM каждого узла (из чего он состоит) загружается позже отдельным документом.

---

## Готовый endpoint в metalpro-ai-polygon

Сервис metalpro-ai-polygon уже реализован и задеплоен.
URL: `http://erppark.ru:4000` (или из env переменной `METALPRO_URL` / `AI_POLYGON_URL`)

### Единственный нужный endpoint:

```
POST http://erppark.ru:4000/api/ai-bom/extract-assemblies-from-text
Content-Type: application/json

{ "text": "...тело письма целиком..." }
```

**Ответ (~3-8 сек):**
```json
{
  "assemblies": [
    {
      "name": "Консоль кабельного короба К-1 6466/03.0028-Н-ИС-4",
      "designation": "6466/03.0028-Н-ИС-4",
      "quantity": 27,
      "unit": "шт.",
      "confidence": 0.95,
      "rawText": "Консоль кабельного короба К-1 6466/03.0028-Н-ИС-4  325-09Г2С-12  27 шт"
    },
    {
      "name": "Консоль кабельного короба К-2 6466/03.0028-П-ИС-4",
      "designation": "6466/03.0028-П-ИС-4",
      "quantity": 4,
      "unit": "шт.",
      "confidence": 0.95,
      "rawText": "..."
    }
  ]
}
```

Никакого upload, никакого documentId, никакого polling — просто текст письма → список узлов.

---

## Что нужно найти в erp-metal

Найти код, который срабатывает при нажатии кнопки "КП из письма".

Искать по ключевым словам:
- `fromEmail`, `from-email`, `createFromEmail`
- `aiExtracted`
- `rfq`, `quote`, `КП`
- Скорее всего: `POST /api/rfq/from-email` или похожий endpoint

---

## Что именно изменить

### Текущее поведение:
Берёт `aiExtracted` из EmailMessage и создаёт строки как **материалы** в BOM.

### Новое поведение:

```javascript
// 1. Вызвать metalpro-ai-polygon с текстом письма
const response = await fetch(`${process.env.METALPRO_URL}/api/ai-bom/extract-assemblies-from-text`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: email.bodyText }),
});
const { assemblies } = await response.json();

// 2. Для каждого assembly создать УЗЕЛ в RFQ, а не материал
for (const assembly of assemblies) {
  // создать node/assembly со следующими полями:
  // name        ← assembly.name
  // designation ← assembly.designation (если есть)
  // quantity    ← assembly.quantity
  // BOM узла    ← пустой (заполнится позже из PDF/Excel)
}
```

---

## Что НЕ трогать

- Логику создания самого RFQ (заголовок, клиент, объект) — не менять
- Обработку вложений (attachments) — не трогать
- Email Copilot AI-анализ (aiIntent, aiSummary и т.д.) — не трогать
- LKM и Метизы разделы — не трогать

---

## Итог: что должно измениться для пользователя

**До:** "КП из письма" → RFQ → МАТЕРИАЛЫ (плоский список, все "без матча")
**После:** "КП из письма" → RFQ → УЗЛЫ (один узел на каждое изделие из письма, BOM пустой)
