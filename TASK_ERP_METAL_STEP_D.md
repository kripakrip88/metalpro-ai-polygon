# Задача для erp-metal: Шаг D — Приём BOM callback от metalpro-ai-polygon

## Контекст

metalpro-ai-polygon делает OCR+AI на загруженном документе и по завершении
отправляет callback в erp-metal с извлечёнными позициями BOM.

Шаг D — принять этот callback и заполнить BOM узла в erp-metal.

---

## Точный формат входящего payload

```
POST /internal/bom-extracted
Content-Type: application/json
```

```json
{
  "rfqId":         "uuid-rfq",
  "assemblyId":    "uuid-metalpro",
  "erpAssemblyId": "uuid-erp-assembly",
  "status":        "completed",
  "items": [
    {
      "position":    1,
      "name":        "Труба профильная 60×40×4",
      "profileType": "pipe_profile",
      "steelGrade":  "09Г2С",
      "gost":        "ГОСТ 8639",
      "lengthMm":    2400,
      "quantity":    6,
      "unit":        "шт.",
      "massTotalKg": 11.1,
      "confidence":  0.95
    }
  ]
}
```

Если ошибка извлечения:

```json
{
  "rfqId":         "uuid-rfq",
  "assemblyId":    "uuid-metalpro",
  "erpAssemblyId": "uuid-erp-assembly",
  "status":        "failed",
  "error":         "Claude API timeout"
}
```

**Ключевые поля:**
- `erpAssemblyId` — ID узла в erp-metal (вот по чему искать узел)
- `rfqId` — ID RFQ в erp-metal (для дополнительной проверки)
- `status` — `"completed"` или `"failed"`
- `items[]` — позиции BOM (только при `status === "completed"`)

---

## Что реализовать в erp-metal

### 1. Найти файл с роутами для RFQ или внутренних endpoint-ов

Ищи по ключевым словам:
- `internal`, `bom-extracted`, `fromEmail`, `createRfq`
- Скорее всего роуты лежат в: `routes/`, `server.js`, `app.js`, или `src/routes/`

Добавить endpoint в подходящий файл роутов:
```
POST /internal/bom-extracted
```

### 2. Найти модель Assembly / Node / Узел

Ищи по ключевым словам:
- `Assembly`, `RfqAssembly`, `RfqNode`, `assembly_id`, `assemblyId`
- Файлы: `models/`, `src/models/`, схемы Prisma, Sequelize, или SQL

Нужно найти:
- Таблицу / модель где хранятся узлы RFQ
- Поле статуса узла (status, bomStatus, state?)
- Связь узла с BOM / materialRows

### 3. Найти модель BOM / materialRows

Ищи по ключевым словам:
- `materialRow`, `material_row`, `bomItem`, `bom_item`
- `BomRow`, `RfqItem`, `rfq_item`, `position`

Нужно понять структуру: что за поля у одной строки BOM.

---

## Логика endpoint-а

```javascript
// Псевдокод — адаптируй под реальный стек erp-metal

router.post('/internal/bom-extracted', async (req, res) => {
  const { rfqId, erpAssemblyId, status, items, error } = req.body;

  try {
    // 1. Найти узел
    const assembly = await Assembly.findByPk(erpAssemblyId);
    // или: await db.query('SELECT * FROM assemblies WHERE id = $1', [erpAssemblyId])
    if (!assembly) {
      return res.status(404).json({ error: 'Assembly not found' });
    }

    if (status === 'failed') {
      // Записать ошибку, не падать
      await assembly.update({
        bomStatus: 'error',
        bomError: error ?? 'AI extraction failed',
      });
      return res.json({ ok: true });
    }

    // 2. Создать строки BOM из items[]
    for (const item of items ?? []) {
      await MaterialRow.create({
        assemblyId: erpAssemblyId,
        rfqId,
        position:    item.position,
        name:        item.name,
        quantity:    item.quantity,
        unit:        item.unit,
        lengthMm:    item.lengthMm    ?? null,
        massUnitKg:  item.massUnitKg  ?? null,  // если поле есть
        massTotalKg: item.massTotalKg ?? null,
        notes:       `AI confidence: ${item.confidence ?? '?'}`,
        source:      'ai',
      });
    }

    // 3. Обновить статус узла
    await assembly.update({
      bomStatus: 'pending_confirmation',  // или строка "BOM требует подтверждения"
    });

    return res.json({ ok: true, itemsCreated: items?.length ?? 0 });

  } catch (err) {
    console.error('[bom-extracted] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});
```

---

## Поля каждой строки BOM

| Поле из callback | Что сохранить |
|-----------------|---------------|
| `item.position` | номер позиции |
| `item.name` | название материала |
| `item.quantity` | количество |
| `item.unit` | единица измерения |
| `item.lengthMm` | длина в мм (если модель поддерживает) |
| `item.massTotalKg` | масса итог в кг (если поддерживает) |
| `item.confidence` | в поле `notes` как строку: `"AI confidence: 0.95"` |
| `item.steelGrade` | марка стали (в notes или отдельное поле) |
| `item.gost` | ГОСТ (в notes или отдельное поле) |

Если в модели нет отдельного поля `lengthMm` / `massTotalKg` — упаковать всё в `notes` как JSON.

---

## Обновление статуса узла

После заполнения BOM — обновить статус сборки (узла):

```javascript
// Ищи существующие статусы в модели Assembly
// Варианты: bomStatus, status, aiStatus, state

await assembly.update({
  bomStatus: 'pending_confirmation',  // или
  // status: 'BOM требует подтверждения',
});
```

Точное значение статуса — посмотри какие значения уже есть в модели / в коде.

---

## Что НЕ трогать

- Существующую логику создания RFQ и узлов (Шаг B) — не менять
- Другие роуты — не трогать
- Email Copilot — не трогать

---

## Порядок реализации

1. Прочитать модели Assembly и MaterialRow/BomItem — понять поля и связи
2. Найти файл роутов где добавить `/internal/bom-extracted`
3. Реализовать endpoint согласно псевдокоду выше
4. Убедиться что endpoint не падает при `status === "failed"` (graceful degradation)
5. Проверить: нет ли уже такого роута (если Step C уже запускался)

---

## Тест вручную (curl)

```bash
curl -X POST http://localhost:3000/internal/bom-extracted \
  -H "Content-Type: application/json" \
  -d '{
    "rfqId": "test-rfq-id",
    "erpAssemblyId": "test-assembly-id",
    "assemblyId": "metalpro-uuid",
    "status": "completed",
    "items": [
      {
        "position": 1,
        "name": "Труба профильная 60x40x4",
        "quantity": 6,
        "unit": "шт.",
        "lengthMm": 2400,
        "massTotalKg": 11.1,
        "confidence": 0.95
      }
    ]
  }'
```

---

## Итог для пользователя

После реализации: пользователь загружает документ через "Добавить документ" → metalpro-ai-polygon делает OCR+AI → через 30–60 сек callback приходит в erp-metal → BOM узла заполняется автоматически → статус узла меняется на "BOM требует подтверждения".
