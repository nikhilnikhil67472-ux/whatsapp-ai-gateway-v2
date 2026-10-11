export const SQL_INIT_TABLES = `
  CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    plan_tier TEXT NOT NULL DEFAULT 'starter',
    instance_limit INTEGER NOT NULL DEFAULT 10,
    monthly_message_quota INTEGER NOT NULL DEFAULT 50000,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS whatsapp_instances (
    id TEXT PRIMARY KEY,
    org_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    instance_name TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'created',
    phone_number TEXT,
    push_name TEXT,
    qr_base64 TEXT,
    qr_updated_at TEXT,
    last_connection_at TEXT,
    last_disconnection_at TEXT,
    logged_out_at TEXT,
    proxy_url TEXT,
    pairing_phone TEXT,
    warmup_day INTEGER NOT NULL DEFAULT 1,
    daily_sent_count INTEGER NOT NULL DEFAULT 0,
    last_sent_date TEXT,
    events_config TEXT,
    ai_enabled INTEGER NOT NULL DEFAULT 1,
    ai_provider TEXT NOT NULL DEFAULT 'openai',
    ai_model TEXT,
    ai_system_prompt TEXT,
    ai_api_key_encrypted TEXT,
    ai_memory_messages INTEGER NOT NULL DEFAULT 20,
    n8n_webhook_url TEXT,
    n8n_secret_encrypted TEXT,
    webhook_url TEXT,
    webhook_secret TEXT,
    reject_calls INTEGER NOT NULL DEFAULT 1,
    ignore_groups INTEGER NOT NULL DEFAULT 0,
    sandbox_mode INTEGER NOT NULL DEFAULT 0,
    outbound_per_minute INTEGER NOT NULL DEFAULT 30,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
    remote_jid TEXT NOT NULL,
    display_name TEXT,
    is_group INTEGER NOT NULL DEFAULT 0,
    last_message_at TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(instance_id, remote_jid)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL,
    remote_jid TEXT NOT NULL,
    whatsapp_message_id TEXT NOT NULL,
    from_me INTEGER NOT NULL DEFAULT 0,
    direction TEXT NOT NULL,
    message_type TEXT,
    text_content TEXT,
    caption TEXT,
    media_url TEXT,
    raw_payload TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(instance_id, whatsapp_message_id)
  );

  CREATE TABLE IF NOT EXISTS outbound_messages (
    id TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
    conversation_id TEXT,
    remote_jid TEXT NOT NULL,
    reply_type TEXT NOT NULL,
    text_content TEXT,
    media_url TEXT,
    media_type TEXT,
    mime_type TEXT,
    quoted_message_id TEXT,
    payload TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT,
    created_at TEXT NOT NULL,
    sent_at TEXT
  );

  CREATE TABLE IF NOT EXISTS worker_commands (
    id TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
    command TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payload TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    target_url TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    response_status INTEGER,
    response_body TEXT,
    duration_ms INTEGER,
    error_message TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ai_runs (
    id TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
    message_id TEXT,
    provider TEXT NOT NULL,
    model TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    duration_ms INTEGER,
    response_text TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS event_logs (
    id TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
    remote_jid TEXT NOT NULL,
    name TEXT,
    opted_out INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE(instance_id, remote_jid)
  );

  CREATE TABLE IF NOT EXISTS auto_reply_rules (
    id TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    match_type TEXT NOT NULL DEFAULT 'exact',
    match_value TEXT NOT NULL,
    reply_text TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    prefix TEXT NOT NULL,
    scopes TEXT NOT NULL DEFAULT '["*"]',
    allowed_ips TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    last_used_at TEXT
  );

  CREATE TABLE IF NOT EXISTS baileys_auth_creds (
    instance_id TEXT PRIMARY KEY REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS baileys_auth_keys (
    instance_id TEXT NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
    key_type TEXT NOT NULL,
    key_id TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(instance_id, key_type, key_id)
  );

  CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_messages_instance_remote ON messages(instance_id, remote_jid);
  CREATE INDEX IF NOT EXISTS idx_outbound_status ON outbound_messages(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_commands_status ON worker_commands(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhook_deliveries(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_events_instance ON event_logs(instance_id, created_at);
`;
