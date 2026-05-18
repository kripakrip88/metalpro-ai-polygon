-- Stage 5: Email Copilot

CREATE TABLE IF NOT EXISTS email_threads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject         TEXT,
  erp_customer_id UUID,
  erp_contact_id  UUID,
  erp_order_id    UUID,
  status          TEXT NOT NULL DEFAULT 'new',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id       UUID REFERENCES email_threads(id),
  message_id      TEXT UNIQUE,
  direction       TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_address    TEXT NOT NULL,
  to_address      TEXT NOT NULL,
  subject         TEXT,
  body_text       TEXT,
  body_html       TEXT,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ai_intent       TEXT,
  ai_priority     TEXT,
  ai_confidence   FLOAT,
  ai_summary      TEXT,
  ai_extracted    JSONB,
  ai_drafts       JSONB,
  ai_model_used   TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  replied_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_attachments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id   UUID NOT NULL REFERENCES email_messages(id),
  filename     TEXT NOT NULL,
  mime_type    TEXT,
  size_bytes   INTEGER,
  storage_path TEXT,
  ocr_text     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_messages_thread    ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_status    ON email_messages(status);
CREATE INDEX IF NOT EXISTS idx_email_messages_msgid     ON email_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_status     ON email_threads(status);
CREATE INDEX IF NOT EXISTS idx_email_threads_customer   ON email_threads(erp_customer_id);
