# ТЗ: Мини-CRM + Email Copilot интеграция для erp-metal

## Контекст

Репозиторий: `kripakrip88/erp-metal`
Стек: Node.js, Prisma ORM, PostgreSQL, Vanilla JS (без фреймворков).
Ветка для разработки: создать `feature/crm-email-copilot` от `develop`.

У нас есть основная ERP-система для металлообработки. В ней есть заказы (`Order`), но нет CRM-сущностей — только строка `customerName` на заказе. Нужно добавить полноценный мини-CRM и страницу Email Copilot.

---

## Что нужно сделать

### 1. Обновить `prisma/schema.prisma`

Добавить новые enum'ы и модели **в конец файла**:

```prisma
enum CustomerPriority {
  VIP
  HIGH
  NORMAL
  LOW
}

enum InteractionType {
  EMAIL
  CALL
  MEETING
  NOTE
}

enum InteractionDirection {
  INBOUND
  OUTBOUND
}

model Customer {
  id          String           @id @default(uuid())
  companyId   String
  name        String
  inn         String?
  phone       String?
  email       String?
  website     String?
  notes       String?
  priority    CustomerPriority @default(NORMAL)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  deletedAt   DateTime?

  company      Company       @relation(fields: [companyId], references: [id])
  contacts     Contact[]
  orders       Order[]
  interactions Interaction[]

  @@index([companyId])
  @@index([email])
  @@map("crm_customers")
}

model Contact {
  id         String   @id @default(uuid())
  customerId String
  name       String
  phone      String?
  email      String?
  position   String?
  notes      String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  customer     Customer      @relation(fields: [customerId], references: [id])
  interactions Interaction[]

  @@index([customerId])
  @@index([email])
  @@map("crm_contacts")
}

model Interaction {
  id             String               @id @default(uuid())
  customerId     String
  contactId      String?
  orderId        String?
  type           InteractionType
  direction      InteractionDirection
  subject        String?
  body           String?
  emailMessageId String?              @unique
  createdAt      DateTime             @default(now())
  createdById    String

  customer  Customer  @relation(fields: [customerId], references: [id])
  contact   Contact?  @relation(fields: [contactId], references: [id])
  order     Order?    @relation(fields: [orderId], references: [id])
  createdBy User      @relation("InteractionCreatedBy", fields: [createdById], references: [id])

  @@index([customerId])
  @@index([orderId])
  @@map("crm_interactions")
}
```

Также изменить в **существующих моделях**:

**`model Company`** — добавить relation:
```prisma
customers Customer[]
```

**`model User`** — добавить relation:
```prisma
interactionsCreated Interaction[] @relation("InteractionCreatedBy")
```

**`model Order`** — добавить поле и relation:
```prisma
customerId String?   // новое поле, перед orderNumber
// ...
customer    Customer? @relation(fields: [customerId], references: [id])
interactions Interaction[]
// в @@index добавить:
@@index([customerId])
```

---

### 2. Создать миграцию

Файл: `prisma/migrations/20260518000000_crm_models/migration.sql`

```sql
CREATE TYPE "CustomerPriority" AS ENUM ('VIP', 'HIGH', 'NORMAL', 'LOW');
CREATE TYPE "InteractionType" AS ENUM ('EMAIL', 'CALL', 'MEETING', 'NOTE');
CREATE TYPE "InteractionDirection" AS ENUM ('INBOUND', 'OUTBOUND');

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customerId" TEXT;

CREATE TABLE "crm_customers" (
  "id"        TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "inn"       TEXT,
  "phone"     TEXT,
  "email"     TEXT,
  "website"   TEXT,
  "notes"     TEXT,
  "priority"  "CustomerPriority" NOT NULL DEFAULT 'NORMAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "crm_customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_contacts" (
  "id"         TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "phone"      TEXT,
  "email"      TEXT,
  "position"   TEXT,
  "notes"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_interactions" (
  "id"             TEXT NOT NULL,
  "customerId"     TEXT NOT NULL,
  "contactId"      TEXT,
  "orderId"        TEXT,
  "type"           "InteractionType" NOT NULL,
  "direction"      "InteractionDirection" NOT NULL,
  "subject"        TEXT,
  "body"           TEXT,
  "emailMessageId" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById"    TEXT NOT NULL,
  CONSTRAINT "crm_interactions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "crm_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_customers" ADD CONSTRAINT "crm_customers_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "crm_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "crm_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_interactions" ADD CONSTRAINT "crm_interactions_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "crm_customers_companyId_idx"      ON "crm_customers"("companyId");
CREATE INDEX "crm_customers_email_idx"           ON "crm_customers"("email");
CREATE INDEX "crm_contacts_customerId_idx"       ON "crm_contacts"("customerId");
CREATE INDEX "crm_contacts_email_idx"            ON "crm_contacts"("email");
CREATE INDEX "crm_interactions_customerId_idx"   ON "crm_interactions"("customerId");
CREATE INDEX "crm_interactions_orderId_idx"      ON "crm_interactions"("orderId");
CREATE UNIQUE INDEX "crm_interactions_emailMessageId_key"
  ON "crm_interactions"("emailMessageId") WHERE "emailMessageId" IS NOT NULL;
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");
```

---

### 3. Создать сервисные файлы

#### `src/services/customerService.js`

Функции (следовать паттерну `orderService.js` с Prisma):
- `listCustomers({ search, email })` — поиск по `companyId` текущей компании, `deletedAt: null`, include contacts (5 шт.) + `_count: { orders, interactions }`, order: priority asc, name asc
- `getCustomer(id)` — include contacts, orders (последние 20, поля id/orderNumber/title/status/createdAt), interactions (последние 20, include contact + createdBy)
- `createCustomer(data)` — поля: name, inn, phone, email, website, notes, priority
- `updateCustomer(id, data)` — те же поля
- `deleteCustomer(id)` — soft delete: `deletedAt: new Date()`

#### `src/services/contactService.js`

- `listContacts(customerId)` — все контакты заказчика
- `createContact(customerId, data)` — поля: name, phone, email, position, notes
- `updateContact(id, data)`
- `deleteContact(id)` — hard delete (prisma.contact.delete)

#### `src/services/interactionService.js`

- `listInteractions(customerId, { limit })` — orderBy createdAt desc, include contact (name), order (orderNumber/title), createdBy (firstName/lastName)
- `createInteraction(data)` — поля: customerId, contactId, orderId, type, direction, subject, body, emailMessageId, createdById. Если createdById не передан — берём первого активного пользователя компании.

---

### 4. Создать `src/routes/customers.js`

Паттерн — как в `src/routes/materials.js` (массив объектов `{ method, pathname, handler }`).

Маршруты:
```
GET    /api/customers              → listCustomers({ search, email из query })
POST   /api/customers              → createCustomer(body), 201
GET    /api/customers/:id          → getCustomer(id), 404 если нет
PUT    /api/customers/:id          → updateCustomer(id, body)
DELETE /api/customers/:id          → deleteCustomer(id)

GET    /api/customers/:id/contacts → listContacts(id)
POST   /api/customers/:id/contacts → createContact(id, body), 201
PUT    /api/contacts/:id           → updateContact(id, body)
DELETE /api/contacts/:id           → deleteContact(id)

GET    /api/customers/:id/interactions → listInteractions(id, { limit из query })
POST   /api/interactions               → createInteraction(body), 201
```

Валидация: `name` обязательно для POST /customers и POST /contacts. `customerId`, `type`, `direction` обязательны для POST /interactions.

---

### 5. Обновить `server.js`

Добавить строку после `...require('./src/routes/templates')`:
```js
...require('./src/routes/customers'),
```

---

### 6. Создать `public/crm.html` — список клиентов

Страница в стиле `public/materials.html` (тот же CSS, тот же sidebar).

**Sidebar** — добавить новую группу «CRM» перед группой «Справочники»:
```html
<div class="nav-group">CRM</div>
<a class="nav-item active" href="crm.html"><span>👥</span> Клиенты</a>
<a class="nav-item" href="email-inbox.html"><span>📧</span> Входящие письма</a>
```

**Контент:**
- Кнопка «+ Новый клиент» в topbar
- Поле поиска по названию (debounce 300ms)
- Таблица: Компания, ИНН, Email, Телефон, Заказов (count), Приоритет (badge)
- Клик по строке → `customer.html?id={id}`
- Модальное окно создания: name (обяз.), inn, email, phone, website, priority (select)
- Бейджи приоритетов: VIP=фиолетовый, HIGH=синий, NORMAL=зелёный, LOW=серый
- API: `GET /api/customers?search=...`, `POST /api/customers`
- Auth: `Authorization: Bearer {localStorage.erp_token}` на всех запросах

---

### 7. Создать `public/customer.html` — карточка клиента

URL: `customer.html?id={customerId}`

**Layout:** двухколоночный (320px слева + остальное справа).

**Левая колонка:**
- Карточка с полями: Компания, ИНН, Email, Телефон, Сайт, Приоритет (badge)
- Блок «Контакты» — список с именем/должностью/email/телефоном, кнопка «+ Контакт»

**Правая колонка — табы:**
- **Заказы** — таблица: Номер, Объект, Статус (badge), Дата. Клик → `orders.html`
- **История взаимодействий** — список: тип (EMAIL/CALL/...), направление (входящее/исходящее badge), тема, текст, дата

**Topbar:**
- Кнопка «← Назад» → `crm.html`
- Кнопка **«+ Заявка на КП»** → открывает модальное окно
  - Поля: «Название объекта» (обяз.), «Примечание»
  - При submit: `POST /api/orders` с `{ orderNumber: "RFQ-{timestamp}", customerName: customer.name, customerId: customer.id, title, description }`
  - После создания → `simulator.html?orderId={новый id}`
- Кнопка «+ Контакт»

**Модальное окно «Добавить контакт»:** name, position, email, phone → `POST /api/customers/:id/contacts`

**API:** `GET /api/customers/:id`, `POST /api/customers/:id/contacts`, `POST /api/orders`

---

### 8. Создать `public/email-inbox.html` — Email Copilot Inbox

> Эта страница работает с **отдельным AI-сервисом** `metalpro-ai-polygon` (порт 4000 или через `window.AI_API_URL`). Сам erp-metal не обрабатывает письма — только показывает UI.

**Layout:** двухпанельный. Слева (340px) — список писем. Справа — детальный просмотр.

**Левая панель:**
- Фильтры: «Новые» (`?status=pending`), «Все», «RFQ» (`?intent=RFQ`)
- Список писем: От кого, Тема, время, badges Intent + Priority
- Клик → загружаем детали в правую панель

**Правая панель (детали выбранного письма):**
1. **Заголовок** — тема, от кого, дата, badges (Intent, Priority, уверенность %, модель)
2. **AI-резюме** — текст из `aiSummary` (если есть)
3. **Текст письма** — полный `bodyText`
4. **Извлечённые позиции** — таблица из `aiExtracted.items[]` (если есть): Наименование, Кол-во, Ед., Материал
5. **Извлечённые данные** — сетка: Компания, Контакт, Срок, Валюта
6. **3 варианта ответа** — карточки из `aiDrafts[]`. Клик на карточку → выбирает её (подсвечивает синим) и вставляет текст в textarea
7. **Редактор ответа** — `<textarea>` + кнопки:
   - **«Отправить»** → `POST {AI_API}/api/email-copilot/reply` `{ messageId, replyBody, sentBy: "manager" }`
   - **«+ Заявка на КП»** (показывается если `aiSuggestRfq === true`) → prompt() → `POST {AI_API}/api/email-copilot/create-rfq` → если успех и пользователь соглашается → `simulator.html?orderId=...`
   - **«В архив»** → `POST {AI_API}/api/email-copilot/archive/:id`

**Topbar:**
- Кнопка «⟳ Проверить почту» → `POST {AI_API}/api/email-copilot/poll` → показывает «Получено: N новых»
- Текст «Последнее обновление: HH:MM»

**JavaScript:**
```js
// URL AI-сервиса — берём из переменной или дефолт
const AI_API = (window.AI_API_URL || 'http://localhost:4000')

// Загрузка списка писем
GET {AI_API}/api/email-copilot/inbox?status=pending
// Ответ: { messages: [...], total: N }
```

**Поля `message` из AI-сервиса:**
```js
{
  id, messageId, threadId,
  fromAddress, toAddress, subject,
  bodyText, receivedAt,
  aiIntent,      // "RFQ" | "ORDER" | "QUESTION" | "COMPLAINT" | "SPAM" | "OTHER"
  aiPriority,    // "critical" | "urgent" | "normal" | "low"
  aiConfidence,  // 0.0 - 1.0
  aiSummary,     // текст на русском
  aiExtracted,   // { company, contact, items: [...], deadline, currency }
  aiDrafts,      // [ { strategy: "...", body: "..." }, ... ]
  aiSuggestRfq,  // boolean
  aiModelUsed,   // "claude" | "llama"
  status         // "pending" | "replied" | "archived"
}
```

---

### 9. Обновить навигацию в существующих страницах

В `public/orders.html`, `public/materials.html`, `public/templates.html`, `public/simulator.html` — найти `<div class="nav-group">Справочники</div>` и **добавить перед ним**:

```html
<div class="nav-group">CRM</div>
<a class="nav-item" href="crm.html"><span>👥</span> Клиенты</a>
<a class="nav-item" href="email-inbox.html"><span>📧</span> Входящие письма</a>
```

---

## Краткое резюме изменений

| Файл | Действие |
|------|----------|
| `prisma/schema.prisma` | Добавить Customer, Contact, Interaction модели + обновить Company, User, Order |
| `prisma/migrations/20260518000000_crm_models/migration.sql` | Создать |
| `src/services/customerService.js` | Создать |
| `src/services/contactService.js` | Создать |
| `src/services/interactionService.js` | Создать |
| `src/routes/customers.js` | Создать |
| `server.js` | Добавить 1 строку |
| `public/crm.html` | Создать |
| `public/customer.html` | Создать |
| `public/email-inbox.html` | Создать |
| `public/orders.html` | Добавить CRM в sidebar |
| `public/materials.html` | Добавить CRM в sidebar |
| `public/templates.html` | Добавить CRM в sidebar |
| `public/simulator.html` | Добавить CRM в sidebar |

---

## Проверка

1. `npx prisma migrate deploy` — должно пройти без ошибок
2. `GET /api/customers` — возвращает `[]` (пустой список)
3. `POST /api/customers` `{ "name": "ООО Тест" }` — возвращает созданного клиента с id
4. Открыть `crm.html` — видна страница со списком, кнопка «+ Новый клиент» работает
5. Создать клиента → открыть `customer.html?id=...` → видна карточка
6. Кнопка «+ Заявка на КП» → вводим название → создаётся Order → переходим в `simulator.html`
7. Открыть `email-inbox.html` — загружается страница (список будет пустой, это нормально — AI-сервис отдельный)
