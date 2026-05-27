# MetalPro AI Polygon — Claude Rules

## Что это за репозиторий

AI-модуль для MetalPro ERP. Парсинг входящих документов (PDF, изображения),
OCR, извлечение данных через Claude API + Llama, нормализация и передача в основную ERP.

**Связанный репозиторий:** https://github.com/kripakrip88/erp-metal

---

## Перед началом любой задачи

1. Прочитать `CLAUDE.md` (этот файл)
2. Прочитать `CONTEXT.md` этого репо
3. Прочитать `CHANGELOG.md` этого репо
4. Если задача затрагивает интеграцию с ERP — прочитать `CONTEXT.md` из erp-metal
5. Показать план изменений и ждать подтверждения владельца

---

## Стек

- **Runtime:** NestJS + TypeScript
- **Database:** PostgreSQL
- **AI Primary:** Claude API (claude-sonnet-4-20250514)
- **AI Benchmark:** Llama через Ollama (абстракция LlamaInferenceProvider)
- **OCR:** Tesseract (rus + eng)
- **Orchestration:** n8n
- **Запуск:** Docker Compose

---

## Архитектурные принципы

- Claude = primary модель (определяет document.status)
- Llama = benchmark (сбой = только телеметрия, document.status не меняется)
- Promise.allSettled — независимые домены отказов между моделями
- ExtractionTelemetryService — append-only, fire-and-forget записи
- Одинаковый промпт для обеих моделей (ClaudePromptBuilderService, temperature=0)
- Один валидатор для обеих моделей (safeParseClaudeResponse)
- Не добавлять ensemble/voting логику без явного согласования

---

## Текущий прогресс

| Stage | Название | Статус |
|-------|----------|--------|
| Stage 1 | Infrastructure + DB schema | ✅ Готов |
| Stage 2 | Upload + Async OCR pipeline | ✅ Готов |
| Stage 3 | Claude Extraction (3-layer persistence) | ✅ Готов |
| Stage 4 | Llama Parallel Extraction + Telemetry | ✅ Готов |
| Stage 5 | Normalization Layer | 🔄 В работе |

### Stage 5 — план
- MaterialNormalizationService
- Alias matching против materials_dictionary
- Supplier-aware mappings
- User correction feedback loops
- Output: user-facing draft BOM → ai_extraction_results

---

## Как работает деплой — ВАЖНО

Claude Code НЕ подключается к серверу напрямую по SSH.
Не искать SSH ключи — их нет в локальном окружении Claude Code.
Весь деплой происходит через GitHub Actions автоматически.

```
Claude Code (локально)
    ↓ git push
GitHub
    ↓ GitHub Actions (автодеплой)
Сервер (5.35.92.112 / erppark.ru)
```

### Окружения

| Окружение | Ветка | URL | БД |
|-----------|-------|-----|----|
| Production | `main` | http://erppark.ru | `erp_metal` |
| Staging | `develop` | http://erppark.ru:3000 | `erp_metal_staging` |

### Проверка статуса деплоя
https://github.com/kripakrip88/metalpro-ai-polygon/actions

---

## Правила веток

- **Никогда не пушить напрямую в `main`**
- Ветки: `feature/...`, `fix/...`, `refactor/...`
- Перед PR показать: список изменений, риски, что тестировалось

### Порядок деплоя
1. Создать ветку и написать код локально
2. `git push origin feature/название`
3. PR: `feature/...` → `develop` → автодеплой на staging
4. Владелец тестирует на http://erppark.ru:3000
5. После ОК: PR `develop` → `main` → автодеплой на prod

---

## Перед любыми изменениями

1. Прочитать связанные файлы
2. Показать план изменений
3. Ждать подтверждения владельца

---

## Правила базы данных

**Разрешено:**
- Создание новых таблиц и колонок
- Добавление индексов
- Безопасные миграции с откатом

**Запрещено без согласования:**
- `DROP TABLE`, `DROP COLUMN`
- Массовое удаление данных
- Изменение типов колонок с потерей данных

---

## Безопасность

- Никогда не выводить токены, пароли, API keys, `.env` содержимое
- Не коммитить `.env`, секреты, большие бинарные файлы

---

## После каждого значимого изменения — ОБЯЗАТЕЛЬНО

### 1. Обновить CHANGELOG.md
```
## YYYY-MM-DD

### metalpro-ai-polygon
- [feat] название — зачем сделано
- [fix] название — что было не так
```
Типы: `feat` / `fix` / `refactor` / `docs` / `migration` / `config` / `breaking`

### 2. Обновить CONTEXT.md если изменилось
- Статус Stage (🔄 → ✅)
- Новая архитектурная деталь
- Изменение инфраструктуры
- Новая связь с erp-metal

### Когда НЕ нужно обновлять
- Мелкие правки одной строки
- Косметические изменения
- Правки только в комментариях

---

## Связь с erp-metal

```
metalpro-ai-polygon              erp-metal
        |                            |
  OCR + AI parsing      →      AI Mail Intake модуль
  Stage 5 BOM draft     →      BOM / Assembly tree
  Нормализация          →      materials_dictionary
```

При изменении контракта между сервисами — помечать `[breaking]` в CHANGELOG
и синхронизировать CONTEXT.md обоих репозиториев.

---

## Decision Making

- Всегда предлагать два варианта: простой и сложный
- Владелец выбирает направление

## Главный принцип

Стабильность данных и воспроизводимость extraction важнее скорости изменений.
