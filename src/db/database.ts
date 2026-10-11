import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { SQL_INIT_TABLES } from './schema.js';
import { hashPassword } from '../security/auth.js';
import { encrypt, decrypt } from '../security/crypto.js';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan_tier: string;
  instance_limit: number;
  monthly_message_quota: number;
  created_at: string;
}

export interface User {
  id: string;
  org_id: string;
  email: string;
  password_hash: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
}

export interface ApiKey {
  id: string;
  org_id: string | null;
  name: string;
  key_hash: string;
  prefix: string;
  scopes: string[];
  allowed_ips: string[] | null;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
}

export interface EventTriggerOption {
  enabled: boolean;
  webhook_url?: string | null;
}

export interface InstanceEventsConfig {
  'messages.upsert'?: EventTriggerOption;
  'messages.update'?: EventTriggerOption;
  'messages.delete'?: EventTriggerOption;
  'presence.update'?: EventTriggerOption;
  'groups.update'?: EventTriggerOption;
  'group-participants.update'?: EventTriggerOption;
  'messages.reaction'?: EventTriggerOption;
  'connection.update'?: EventTriggerOption;
}

export const DEFAULT_EVENTS_CONFIG: InstanceEventsConfig = {
  'messages.upsert': { enabled: true, webhook_url: null },
  'messages.update': { enabled: true, webhook_url: null },
  'messages.delete': { enabled: false, webhook_url: null },
  'presence.update': { enabled: false, webhook_url: null },
  'groups.update': { enabled: false, webhook_url: null },
  'group-participants.update': { enabled: true, webhook_url: null },
  'messages.reaction': { enabled: true, webhook_url: null },
  'connection.update': { enabled: true, webhook_url: null },
};

export interface WhatsAppInstance {
  id: string;
  org_id: string | null;
  instance_name: string;
  status: 'created' | 'connecting' | 'waiting_qr' | 'connected' | 'reconnecting' | 'disconnected' | 'logged_out' | 'stopped' | 'failed';
  phone_number: string | null;
  push_name: string | null;
  qr_base64: string | null;
  qr_updated_at: string | null;
  last_connection_at: string | null;
  last_disconnection_at: string | null;
  logged_out_at: string | null;
  proxy_url: string | null;
  pairing_phone: string | null;
  warmup_day: number;
  daily_sent_count: number;
  last_sent_date: string | null;
  events_config: InstanceEventsConfig;
  ai_enabled: boolean;
  ai_provider: 'openai' | 'anthropic' | 'n8n' | 'webhook';
  ai_model: string | null;
  ai_system_prompt: string | null;
  ai_api_key_encrypted: string | null;
  ai_memory_messages: number;
  n8n_webhook_url: string | null;
  n8n_secret_encrypted: string | null;
  webhook_url: string | null;
  webhook_secret: string | null;
  reject_calls: boolean;
  ignore_groups: boolean;
  sandbox_mode: boolean;
  outbound_per_minute: number;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  instance_id: string;
  remote_jid: string;
  display_name: string | null;
  is_group: boolean;
  last_message_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  instance_id: string;
  conversation_id: string;
  remote_jid: string;
  whatsapp_message_id: string;
  from_me: boolean;
  direction: 'inbound' | 'outbound';
  message_type: string;
  text_content: string | null;
  caption: string | null;
  media_url: string | null;
  raw_payload: any;
  created_at: string;
}

export interface OutboundMessage {
  id: string;
  instance_id: string;
  conversation_id: string | null;
  remote_jid: string;
  reply_type: 'text' | 'media' | 'audio' | 'location' | 'contact' | 'sticker' | 'poll' | string;
  text_content: string | null;
  media_url: string | null;
  media_type: string | null;
  mime_type: string | null;
  quoted_message_id: string | null;
  payload: any;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'simulated' | 'retry';
  error_message: string | null;
  attempts: number;
  next_attempt_at: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface WorkerCommand {
  id: string;
  instance_id: string;
  command: 'start' | 'restart' | 'stop' | 'logout' | 'delete';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payload: any;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface WebhookDelivery {
  id: string;
  instance_id: string;
  event_type: string;
  target_url: string;
  payload: any;
  status: 'pending' | 'sending' | 'delivered' | 'failed' | 'retry';
  response_status: number | null;
  response_body: string | null;
  duration_ms: number | null;
  error_message: string | null;
  attempts: number;
  next_attempt_at: string | null;
  created_at: string;
}

export interface AiRun {
  id: string;
  instance_id: string;
  message_id: string | null;
  provider: string;
  model: string | null;
  status: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  duration_ms: number | null;
  response_text: string | null;
  error_message: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  instance_id: string;
  remote_jid: string;
  name: string | null;
  opted_out: boolean;
  created_at: string;
}

export interface AutoReplyRule {
  id: string;
  instance_id: string;
  name: string;
  match_type: 'exact' | 'contains' | 'regex' | 'starts_with';
  match_value: string;
  reply_text: string;
  enabled: boolean;
  created_at: string;
}

export class GatewayDatabase {
  private db: Database.Database;

  constructor(customPath?: string) {
    const dbFilePath = customPath || config.sqliteDbPath;
    const dbDir = path.dirname(dbFilePath);

    try {
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      this.db = new Database(dbFilePath);

      // Attempt WAL mode; fall back gracefully to DELETE mode if filesystem does not support POSIX shared memory (e.g., NFS, SMB, or network mounts)
      try {
        this.db.pragma('journal_mode = WAL');
      } catch (walErr: any) {
        console.warn(`[Database] WAL journal mode unavailable (${walErr?.message || walErr}). Falling back to DELETE mode.`);
        this.db.pragma('journal_mode = DELETE');
      }

      this.db.pragma('foreign_keys = ON');
      this.db.pragma('busy_timeout = 5000');
      this.init();
    } catch (err: any) {
      if (
        err.code === 'EACCES' ||
        err.code === 'EPERM' ||
        err.message?.includes('readonly') ||
        err.message?.includes('permission') ||
        err.message?.includes('unable to open database file') ||
        err.message?.includes('disk I/O error')
      ) {
        console.error(`\n[FATAL] Database access error for "${dbFilePath}": ${err.message}`);
        console.error(`[FATAL] Check write permissions for directory "${dbDir}".`);
        console.error(`[FATAL] If running in Docker, ensure the mounted volume has UID 1000 permissions (e.g. run "chown -R 1000:1000 ./data" or "chmod -R 777 ./data").\n`);
      }
      throw err;
    }
  }

  public init(): void {
    this.db.exec(SQL_INIT_TABLES);
    this.runMigrations();
    this.ensureDefaultOrganizationAndAdmin();
    try {
      this.db.exec(`
        DELETE FROM messages WHERE remote_jid LIKE '%@newsletter' OR remote_jid LIKE '%@broadcast' OR remote_jid LIKE '%@lid' OR remote_jid = 'status@broadcast' OR remote_jid = '0@s.whatsapp.net';
        DELETE FROM conversations WHERE remote_jid LIKE '%@newsletter' OR remote_jid LIKE '%@broadcast' OR remote_jid LIKE '%@lid' OR remote_jid = 'status@broadcast' OR remote_jid = '0@s.whatsapp.net';
        DELETE FROM contacts WHERE remote_jid LIKE '%@newsletter' OR remote_jid LIKE '%@broadcast' OR remote_jid LIKE '%@lid' OR remote_jid = 'status@broadcast' OR remote_jid = '0@s.whatsapp.net';
      `);
    } catch {
      // ignore
    }
  }

  private runMigrations(): void {
    try {
      // Check whatsapp_instances columns
      const instCols = this.db.prepare('PRAGMA table_info(whatsapp_instances)').all() as { name: string }[];
      const instColNames = new Set(instCols.map((c) => c.name));
      if (!instColNames.has('org_id')) {
        this.db.exec('ALTER TABLE whatsapp_instances ADD COLUMN org_id TEXT;');
      }
      if (!instColNames.has('proxy_url')) {
        this.db.exec('ALTER TABLE whatsapp_instances ADD COLUMN proxy_url TEXT;');
      }
      if (!instColNames.has('pairing_phone')) {
        this.db.exec('ALTER TABLE whatsapp_instances ADD COLUMN pairing_phone TEXT;');
      }
      if (!instColNames.has('warmup_day')) {
        this.db.exec('ALTER TABLE whatsapp_instances ADD COLUMN warmup_day INTEGER NOT NULL DEFAULT 1;');
      }
      if (!instColNames.has('daily_sent_count')) {
        this.db.exec('ALTER TABLE whatsapp_instances ADD COLUMN daily_sent_count INTEGER NOT NULL DEFAULT 0;');
      }
      if (!instColNames.has('last_sent_date')) {
        this.db.exec('ALTER TABLE whatsapp_instances ADD COLUMN last_sent_date TEXT;');
      }
      if (!instColNames.has('events_config')) {
        this.db.exec('ALTER TABLE whatsapp_instances ADD COLUMN events_config TEXT;');
      }

      // Check api_keys columns
      const keyCols = this.db.prepare('PRAGMA table_info(api_keys)').all() as { name: string }[];
      const keyColNames = new Set(keyCols.map((c) => c.name));
      if (!keyColNames.has('org_id')) {
        this.db.exec('ALTER TABLE api_keys ADD COLUMN org_id TEXT;');
      }
      if (!keyColNames.has('scopes')) {
        this.db.exec('ALTER TABLE api_keys ADD COLUMN scopes TEXT NOT NULL DEFAULT \'["*"]\';');
      }
      if (!keyColNames.has('allowed_ips')) {
        this.db.exec('ALTER TABLE api_keys ADD COLUMN allowed_ips TEXT;');
      }
      if (!keyColNames.has('expires_at')) {
        this.db.exec('ALTER TABLE api_keys ADD COLUMN expires_at TEXT;');
      }

      this.db.exec('CREATE INDEX IF NOT EXISTS idx_instances_org ON whatsapp_instances(org_id);');
      this.db.exec('CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(org_id);');
    } catch (err) {
      console.error('[DB Migrations Error]:', err);
    }
  }

  private ensureDefaultOrganizationAndAdmin(): void {
    try {
      const existingOrg = this.db.prepare('SELECT * FROM organizations LIMIT 1').get() as any;
      let defaultOrgId = existingOrg?.id;
      if (!existingOrg) {
        defaultOrgId = 'org_default';
        this.db.prepare(`
          INSERT INTO organizations (id, name, slug, plan_tier, instance_limit, monthly_message_quota, created_at)
          VALUES ('org_default', 'Default Workspace', 'default', 'enterprise', 100, 1000000, ?)
        `).run(this.now());
      }

      const existingUser = this.db.prepare('SELECT * FROM users LIMIT 1').get() as any;
      if (!existingUser) {
        const defaultPasswordHash = hashPassword('admin123');
        this.db.prepare(`
          INSERT INTO users (id, org_id, email, password_hash, name, role, created_at)
          VALUES ('usr_admin', ?, 'admin@gateway.local', ?, 'Admin', 'owner', ?)
        `).run(defaultOrgId, defaultPasswordHash, this.now());
      }

      // Ensure any existing instances & api keys are attached to default organization
      this.db.prepare('UPDATE whatsapp_instances SET org_id = ? WHERE org_id IS NULL').run(defaultOrgId);
      this.db.prepare('UPDATE api_keys SET org_id = ? WHERE org_id IS NULL').run(defaultOrgId);
    } catch (err) {
      console.error('[DB Default Org/User Seed Error]:', err);
    }
  }

  public getDefaultOrgId(): string {
    const org = this.db.prepare('SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1').get() as any;
    return org?.id || 'org_default';
  }

  // --- Organizations & Workspaces ---

  public createOrganization(params: {
    name: string;
    slug?: string;
    plan_tier?: string;
    instance_limit?: number;
    monthly_message_quota?: number;
  }): Organization {
    const id = `org_${crypto.randomBytes(8).toString('hex')}`;
    let baseSlug = (params.slug || params.name.toLowerCase().replace(/[^a-z0-9]/g, '-')).replace(/^-+|-+$/g, '').slice(0, 32);
    if (!baseSlug) baseSlug = 'workspace';
    let slug = baseSlug;

    const existing = this.getOrganizationBySlug(slug);
    if (existing) {
      slug = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;
    }

    const now = this.now();
    this.db.prepare(`
      INSERT INTO organizations (id, name, slug, plan_tier, instance_limit, monthly_message_quota, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.name.trim(),
      slug,
      params.plan_tier || 'starter',
      params.instance_limit || 10,
      params.monthly_message_quota || 50000,
      now
    );
    return this.getOrganization(id)!;
  }

  public getOrganization(id: string): Organization | null {
    const row = this.db.prepare('SELECT * FROM organizations WHERE id = ?').get(id) as any;
    return row || null;
  }

  public getOrganizationBySlug(slug: string): Organization | null {
    const row = this.db.prepare('SELECT * FROM organizations WHERE slug = ?').get(slug) as any;
    return row || null;
  }

  public listOrganizations(): Organization[] {
    return this.db.prepare('SELECT * FROM organizations ORDER BY created_at DESC').all() as Organization[];
  }

  // --- Users ---

  public createUser(params: {
    org_id: string;
    email: string;
    password_hash: string;
    name: string;
    role?: 'owner' | 'admin' | 'member';
  }): User {
    const id = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const now = this.now();
    this.db.prepare(`
      INSERT INTO users (id, org_id, email, password_hash, name, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, params.org_id, params.email.trim().toLowerCase(), params.password_hash, params.name.trim(), params.role || 'member', now);
    return this.getUserById(id)!;
  }

  public getUserById(id: string): User | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    return row || null;
  }

  public getUserByEmail(email: string): User | null {
    const row = this.db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim()) as any;
    return row || null;
  }

  public listUsers(orgId?: string): User[] {
    if (orgId) {
      return this.db.prepare('SELECT * FROM users WHERE org_id = ? ORDER BY created_at DESC').all(orgId) as User[];
    }
    return this.db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as User[];
  }

  public getRawDb(): Database.Database {
    return this.db;
  }

  public close(): void {
    this.db.close();
  }

  public now(): string {
    return new Date().toISOString();
  }

  // --- Instances ---

  public createInstance(params: {
    instance_name: string;
    org_id?: string;
    proxy_url?: string;
    pairing_phone?: string;
    ai_enabled?: boolean;
    ai_provider?: 'openai' | 'anthropic' | 'n8n' | 'webhook';
    ai_model?: string;
    ai_system_prompt?: string;
    ai_api_key_encrypted?: string;
    webhook_url?: string;
    webhook_secret?: string;
    n8n_webhook_url?: string;
    n8n_secret_encrypted?: string;
    sandbox_mode?: boolean;
  }): WhatsAppInstance {
    const id = crypto.randomUUID();
    const now = this.now();
    const orgId = params.org_id || this.getDefaultOrgId();
    const stmt = this.db.prepare(`
      INSERT INTO whatsapp_instances (
        id, org_id, instance_name, status, proxy_url, pairing_phone,
        ai_enabled, ai_provider, ai_model,
        ai_system_prompt, ai_api_key_encrypted, webhook_url, webhook_secret,
        n8n_webhook_url, n8n_secret_encrypted, sandbox_mode, created_at, updated_at
      ) VALUES (
        @id, @org_id, @instance_name, 'created', @proxy_url, @pairing_phone,
        @ai_enabled, @ai_provider, @ai_model,
        @ai_system_prompt, @ai_api_key_encrypted, @webhook_url, @webhook_secret,
        @n8n_webhook_url, @n8n_secret_encrypted, @sandbox_mode, @created_at, @updated_at
      )
    `);

    stmt.run({
      id,
      org_id: orgId,
      instance_name: params.instance_name.trim(),
      proxy_url: params.proxy_url || null,
      pairing_phone: params.pairing_phone || null,
      ai_enabled: params.ai_enabled === false ? 0 : 1,
      ai_provider: params.ai_provider || 'openai',
      ai_model: params.ai_model || null,
      ai_system_prompt: params.ai_system_prompt || null,
      ai_api_key_encrypted: params.ai_api_key_encrypted || null,
      webhook_url: params.webhook_url || null,
      webhook_secret: params.webhook_secret || null,
      n8n_webhook_url: params.n8n_webhook_url || null,
      n8n_secret_encrypted: params.n8n_secret_encrypted || null,
      sandbox_mode: params.sandbox_mode ? 1 : 0,
      created_at: now,
      updated_at: now,
    });

    return this.getInstance(id)!;
  }

  public getInstance(id: string): WhatsAppInstance | null {
    const row = this.db.prepare('SELECT * FROM whatsapp_instances WHERE id = ?').get(id) as any;
    return this.inflateInstance(row);
  }

  /**
   * Supports lookup by UUID OR instance_name to prevent 404 navigation bugs
   */
  public getInstanceByIdentifier(identifier: string, orgId?: string): WhatsAppInstance | null {
    if (orgId) {
      const row = this.db.prepare(`
        SELECT * FROM whatsapp_instances WHERE (id = ? OR instance_name = ?) AND org_id = ?
      `).get(identifier, identifier, orgId) as any;
      return this.inflateInstance(row);
    }
    const row = this.db.prepare(`
      SELECT * FROM whatsapp_instances WHERE id = ? OR instance_name = ?
    `).get(identifier, identifier) as any;
    return this.inflateInstance(row);
  }

  public listInstances(orgId?: string): WhatsAppInstance[] {
    const rows = orgId
      ? (this.db.prepare('SELECT * FROM whatsapp_instances WHERE org_id = ? ORDER BY created_at DESC').all(orgId) as any[])
      : (this.db.prepare('SELECT * FROM whatsapp_instances ORDER BY created_at DESC').all() as any[]);
    return rows.map((r) => this.inflateInstance(r)!);
  }

  public updateInstance(id: string, updates: Partial<Record<string, any>>): boolean {
    const allowed = [
      'org_id', 'proxy_url', 'pairing_phone', 'warmup_day', 'daily_sent_count', 'last_sent_date',
      'events_config',
      'status', 'phone_number', 'push_name', 'qr_base64', 'qr_updated_at',
      'last_connection_at', 'last_disconnection_at', 'logged_out_at',
      'ai_enabled', 'ai_provider', 'ai_model', 'ai_system_prompt',
      'ai_api_key_encrypted', 'ai_memory_messages', 'n8n_webhook_url',
      'n8n_secret_encrypted', 'webhook_url', 'webhook_secret',
      'reject_calls', 'ignore_groups', 'sandbox_mode', 'outbound_per_minute'
    ];

    const fields: string[] = [];
    const values: any = { id, updated_at: this.now() };

    for (const [key, val] of Object.entries(updates)) {
      if (allowed.includes(key)) {
        fields.push(`${key} = @${key}`);
        if (typeof val === 'boolean') {
          values[key] = val ? 1 : 0;
        } else if (key === 'events_config' && typeof val === 'object' && val !== null) {
          values[key] = JSON.stringify(val);
        } else {
          values[key] = val;
        }
      }
    }

    if (fields.length === 0) return false;
    fields.push('updated_at = @updated_at');

    const sql = `UPDATE whatsapp_instances SET ${fields.join(', ')} WHERE id = @id`;
    const res = this.db.prepare(sql).run(values);
    return res.changes > 0;
  }

  public deleteInstance(id: string): boolean {
    // Foreign keys with ON DELETE CASCADE will clean up child tables
    const res = this.db.prepare('DELETE FROM whatsapp_instances WHERE id = ?').run(id);
    return res.changes > 0;
  }

  /**
   * SIM Warm-Up Schedule Engine
   * Prevents WhatsApp bans on newly connected numbers by gradually ramping outbound volume:
   * Day 1: 30 msgs, Day 2: 60 msgs, Day 3: 120 msgs, Day 4: 250 msgs, Day 5+: 500 msgs.
   */
  public checkAndIncrementWarmupLimit(instanceId: string): {
    allowed: boolean;
    limit: number;
    current: number;
    warmupDay: number;
  } {
    const instance = this.getInstance(instanceId);
    if (!instance) {
      return { allowed: false, limit: 0, current: 0, warmupDay: 1 };
    }

    if (instance.sandbox_mode) {
      return { allowed: true, limit: 9999, current: 0, warmupDay: 1 };
    }

    const today = new Date().toISOString().slice(0, 10);
    let warmupDay = Number(instance.warmup_day || 1);
    let dailyCount = Number(instance.daily_sent_count || 0);

    if (instance.last_sent_date !== today) {
      if (instance.last_sent_date) {
        warmupDay = Math.min(30, warmupDay + 1);
      }
      dailyCount = 0;
      this.updateInstance(instanceId, {
        last_sent_date: today,
        daily_sent_count: 0,
        warmup_day: warmupDay,
      });
    }

    const limitsByDay = [30, 60, 120, 250, 500];
    const dailyLimit = warmupDay <= limitsByDay.length ? limitsByDay[warmupDay - 1] : 500;

    if (dailyCount >= dailyLimit) {
      return { allowed: false, limit: dailyLimit, current: dailyCount, warmupDay };
    }

    this.updateInstance(instanceId, {
      daily_sent_count: dailyCount + 1,
      last_sent_date: today,
    });

    return { allowed: true, limit: dailyLimit, current: dailyCount + 1, warmupDay };
  }

  private inflateInstance(row: any): WhatsAppInstance | null {
    if (!row) return null;
    let eventsConfig: InstanceEventsConfig = { ...DEFAULT_EVENTS_CONFIG };
    if (row.events_config) {
      try {
        const parsed = typeof row.events_config === 'string' ? JSON.parse(row.events_config) : row.events_config;
        eventsConfig = { ...DEFAULT_EVENTS_CONFIG, ...parsed };
      } catch {
        // fallback to defaults
      }
    }

    return {
      ...row,
      org_id: row.org_id || null,
      proxy_url: row.proxy_url || null,
      pairing_phone: row.pairing_phone || null,
      warmup_day: Number(row.warmup_day || 1),
      daily_sent_count: Number(row.daily_sent_count || 0),
      last_sent_date: row.last_sent_date || null,
      events_config: eventsConfig,
      ai_enabled: Boolean(row.ai_enabled),
      reject_calls: Boolean(row.reject_calls),
      ignore_groups: Boolean(row.ignore_groups),
      sandbox_mode: Boolean(row.sandbox_mode),
    };
  }

  // --- Conversations & Messages ---

  public upsertConversation(params: {
    instance_id: string;
    remote_jid: string;
    display_name?: string | null;
    is_group?: boolean;
    last_message_at?: string;
  }): Conversation {
    const id = `${params.instance_id}_${params.remote_jid}`;
    const now = this.now();
    this.db.prepare(`
      INSERT INTO conversations (id, instance_id, remote_jid, display_name, is_group, last_message_at, created_at)
      VALUES (@id, @instance_id, @remote_jid, @display_name, @is_group, @last_message_at, @created_at)
      ON CONFLICT(instance_id, remote_jid) DO UPDATE SET
        display_name = COALESCE(@display_name, display_name),
        last_message_at = @last_message_at
    `).run({
      id,
      instance_id: params.instance_id,
      remote_jid: params.remote_jid,
      display_name: params.display_name || null,
      is_group: params.is_group ? 1 : 0,
      last_message_at: params.last_message_at || now,
      created_at: now,
    });

    const row = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any;
    return { ...row, is_group: Boolean(row.is_group) };
  }

  public listConversations(instanceId: string): Conversation[] {
    const rows = this.db.prepare(`
      SELECT * FROM conversations 
      WHERE instance_id = ? 
        AND remote_jid NOT LIKE '%@newsletter'
        AND remote_jid NOT LIKE '%@broadcast'
        AND remote_jid NOT LIKE '%@lid'
        AND remote_jid != 'status@broadcast'
        AND remote_jid != '0@s.whatsapp.net'
      ORDER BY last_message_at DESC
    `).all(instanceId) as any[];
    return rows.map((r) => ({ ...r, is_group: Boolean(r.is_group) }));
  }

  public addMessage(params: {
    instance_id: string;
    conversation_id?: string;
    remote_jid: string;
    whatsapp_message_id: string;
    from_me: boolean;
    direction: 'inbound' | 'outbound';
    message_type?: string;
    text_content?: string | null;
    caption?: string | null;
    media_url?: string | null;
    raw_payload?: any;
    created_at?: string;
  }): string {
    const id = crypto.randomUUID();
    const convId = params.conversation_id || `${params.instance_id}_${params.remote_jid}`;
    const now = params.created_at || this.now();

    // Ensure conversation exists
    this.upsertConversation({
      instance_id: params.instance_id,
      remote_jid: params.remote_jid,
      last_message_at: now,
    });

    this.db.prepare(`
      INSERT OR IGNORE INTO messages (
        id, instance_id, conversation_id, remote_jid, whatsapp_message_id,
        from_me, direction, message_type, text_content, caption, media_url,
        raw_payload, created_at
      ) VALUES (
        @id, @instance_id, @conversation_id, @remote_jid, @whatsapp_message_id,
        @from_me, @direction, @message_type, @text_content, @caption, @media_url,
        @raw_payload, @created_at
      )
    `).run({
      id,
      instance_id: params.instance_id,
      conversation_id: convId,
      remote_jid: params.remote_jid,
      whatsapp_message_id: params.whatsapp_message_id,
      from_me: params.from_me ? 1 : 0,
      direction: params.direction,
      message_type: params.message_type || 'text',
      text_content: params.text_content || null,
      caption: params.caption || null,
      media_url: params.media_url || null,
      raw_payload: JSON.stringify(params.raw_payload || {}),
      created_at: now,
    });

    return id;
  }

  public listMessages(instanceId: string, limit = 50): Message[] {
    const rows = this.db.prepare(`
      SELECT * FROM messages 
      WHERE instance_id = ? 
        AND remote_jid NOT LIKE '%@newsletter'
        AND remote_jid NOT LIKE '%@broadcast'
        AND remote_jid NOT LIKE '%@lid'
        AND remote_jid != 'status@broadcast'
        AND remote_jid != '0@s.whatsapp.net'
        AND (
          (text_content IS NOT NULL AND TRIM(text_content) != '')
          OR (caption IS NOT NULL AND TRIM(caption) != '')
          OR media_url IS NOT NULL
          OR message_type IN ('location', 'contact', 'sticker', 'poll', 'interactive_buttons', 'interactive_list', 'buttons', 'list')
        )
      ORDER BY created_at DESC LIMIT ?
    `).all(instanceId, limit) as any[];
    return rows.map(this.inflateMessage);
  }

  public getRecentMessages(instanceId: string, remoteJid: string, limit = 20, excludeMessageId?: string): Message[] {
    const contentFilter = `
      AND remote_jid NOT LIKE '%@newsletter'
      AND remote_jid NOT LIKE '%@broadcast'
      AND remote_jid NOT LIKE '%@lid'
      AND remote_jid != 'status@broadcast'
      AND remote_jid != '0@s.whatsapp.net'
      AND (
        (text_content IS NOT NULL AND TRIM(text_content) != '')
        OR (caption IS NOT NULL AND TRIM(caption) != '')
        OR media_url IS NOT NULL
        OR message_type IN ('location', 'contact', 'sticker', 'poll', 'interactive_buttons', 'interactive_list', 'buttons', 'list')
      )
    `;
    if (excludeMessageId) {
      const rows = this.db.prepare(`
        SELECT * FROM messages WHERE instance_id = ? AND remote_jid = ? AND id != ? ${contentFilter} ORDER BY created_at DESC LIMIT ?
      `).all(instanceId, remoteJid, excludeMessageId, limit) as any[];
      return rows.map(this.inflateMessage);
    }
    const rows = this.db.prepare(`
      SELECT * FROM messages WHERE instance_id = ? AND remote_jid = ? ${contentFilter} ORDER BY created_at DESC LIMIT ?
    `).all(instanceId, remoteJid, limit) as any[];
    return rows.map(this.inflateMessage);
  }

  private inflateMessage(r: any): Message {
    return {
      ...r,
      from_me: Boolean(r.from_me),
      raw_payload: r.raw_payload ? JSON.parse(r.raw_payload) : null,
    };
  }

  // --- Outbound Messages Queue ---

  public enqueueOutboundMessage(params: {
    instance_id: string;
    conversation_id?: string | null;
    remote_jid: string;
    reply_type: 'text' | 'media' | 'audio' | 'location' | 'contact' | 'sticker' | 'poll' | string;
    text_content?: string | null;
    media_url?: string | null;
    media_type?: string | null;
    mime_type?: string | null;
    quoted_message_id?: string | null;
    payload?: any;
  }): string {
    const id = crypto.randomUUID();
    const now = this.now();
    this.db.prepare(`
      INSERT INTO outbound_messages (
        id, instance_id, conversation_id, remote_jid, reply_type, text_content,
        media_url, media_type, mime_type, quoted_message_id, payload, status,
        created_at
      ) VALUES (
        @id, @instance_id, @conversation_id, @remote_jid, @reply_type, @text_content,
        @media_url, @media_type, @mime_type, @quoted_message_id, @payload, 'pending',
        @created_at
      )
    `).run({
      id,
      instance_id: params.instance_id,
      conversation_id: params.conversation_id || null,
      remote_jid: params.remote_jid,
      reply_type: params.reply_type,
      text_content: params.text_content || null,
      media_url: params.media_url || null,
      media_type: params.media_type || null,
      mime_type: params.mime_type || null,
      quoted_message_id: params.quoted_message_id || null,
      payload: JSON.stringify(params.payload || {}),
      created_at: now,
    });
    return id;
  }

  public getOutboundMessage(id: string): OutboundMessage | null {
    const row = this.db.prepare('SELECT * FROM outbound_messages WHERE id = ?').get(id) as any;
    if (!row) return null;
    return { ...row, payload: row.payload ? JSON.parse(row.payload) : null };
  }

  public listPendingOutboundMessages(limit = 20): OutboundMessage[] {
    const now = this.now();
    const rows = this.db.prepare(`
      SELECT * FROM outbound_messages 
      WHERE status = 'pending' OR (status = 'retry' AND next_attempt_at IS NOT NULL AND next_attempt_at <= ?)
      ORDER BY created_at ASC LIMIT ?
    `).all(now, limit) as any[];
    return rows.map((r) => ({
      ...r,
      payload: r.payload ? JSON.parse(r.payload) : null,
    }));
  }

  public markOutboundMessageStatus(
    id: string,
    status: OutboundMessage['status'],
    error?: string | null,
    nextAttemptAt?: string | null
  ): boolean {
    const now = this.now();
    const sentAt = status === 'sent' || status === 'simulated' ? now : null;
    const res = this.db.prepare(`
      UPDATE outbound_messages 
      SET status = @status,
          error_message = @error,
          sent_at = COALESCE(@sent_at, sent_at),
          attempts = attempts + 1,
          next_attempt_at = @nextAttemptAt
      WHERE id = @id
    `).run({ id, status, error: error || null, sent_at: sentAt, nextAttemptAt: nextAttemptAt || null });
    return res.changes > 0;
  }

  public claimOutboundMessageForSending(id: string): boolean {
    const res = this.db.prepare(`
      UPDATE outbound_messages 
      SET status = 'sending' 
      WHERE id = ? AND (status = 'pending' OR status = 'retry')
    `).run(id);
    return res.changes > 0;
  }

  public reclaimStaleOutboundMessages(timeoutMinutes = 2): number {
    const cutoff = new Date(Date.now() - timeoutMinutes * 60000).toISOString();
    const res = this.db.prepare(`
      UPDATE outbound_messages 
      SET status = 'retry', next_attempt_at = ? 
      WHERE status = 'sending' AND created_at <= ?
    `).run(this.now(), cutoff);
    return res.changes;
  }

  // --- Worker Commands Queue ---

  public enqueueWorkerCommand(
    instance_id: string,
    command: 'start' | 'restart' | 'stop' | 'logout' | 'delete',
    payload?: any
  ): string {
    const id = crypto.randomUUID();
    const now = this.now();
    this.db.prepare(`
      INSERT INTO worker_commands (id, instance_id, command, status, payload, created_at)
      VALUES (@id, @instance_id, @command, 'pending', @payload, @created_at)
    `).run({
      id,
      instance_id,
      command,
      payload: JSON.stringify(payload || {}),
      created_at: now,
    });
    return id;
  }

  public getWorkerCommand(id: string): WorkerCommand | null {
    const row = this.db.prepare('SELECT * FROM worker_commands WHERE id = ?').get(id) as any;
    if (!row) return null;
    return { ...row, payload: row.payload ? JSON.parse(row.payload) : null };
  }

  public listPendingWorkerCommands(limit = 20): WorkerCommand[] {
    const rows = this.db.prepare(`
      SELECT * FROM worker_commands WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?
    `).all(limit) as any[];
    return rows.map((r) => ({
      ...r,
      payload: r.payload ? JSON.parse(r.payload) : null,
    }));
  }

  public markWorkerCommandProcessing(id: string): boolean {
    const res = this.db.prepare(`
      UPDATE worker_commands SET status = 'processing' WHERE id = ? AND status = 'pending'
    `).run(id);
    return res.changes > 0;
  }

  public completeWorkerCommand(id: string): boolean {
    const res = this.db.prepare(`
      UPDATE worker_commands SET status = 'completed', completed_at = ? WHERE id = ?
    `).run(this.now(), id);
    return res.changes > 0;
  }

  public failWorkerCommand(id: string, error: string): boolean {
    const res = this.db.prepare(`
      UPDATE worker_commands SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?
    `).run(error, this.now(), id);
    return res.changes > 0;
  }

  public reclaimStaleWorkerCommands(timeoutMinutes = 5): number {
    const cutoff = new Date(Date.now() - timeoutMinutes * 60000).toISOString();
    const res = this.db.prepare(`
      UPDATE worker_commands 
      SET status = 'pending' 
      WHERE status = 'processing' 
        AND created_at <= ?
    `).run(cutoff);
    return res.changes;
  }

  // --- Webhook Deliveries ---

  public enqueueWebhookDelivery(params: {
    instance_id: string;
    event_type: string;
    target_url: string;
    payload: any;
  }): string {
    const id = crypto.randomUUID();
    const now = this.now();
    this.db.prepare(`
      INSERT INTO webhook_deliveries (
        id, instance_id, event_type, target_url, payload, status, created_at
      ) VALUES (
        @id, @instance_id, @event_type, @target_url, @payload, 'pending', @created_at
      )
    `).run({
      id,
      instance_id: params.instance_id,
      event_type: params.event_type,
      target_url: params.target_url,
      payload: JSON.stringify(params.payload),
      created_at: now,
    });
    return id;
  }

  public getWebhookDelivery(id: string): WebhookDelivery | null {
    const row = this.db.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(id) as any;
    if (!row) return null;
    return { ...row, payload: row.payload ? JSON.parse(row.payload) : null };
  }

  public listPendingWebhookDeliveries(limit = 20): WebhookDelivery[] {
    const now = this.now();
    const rows = this.db.prepare(`
      SELECT * FROM webhook_deliveries
      WHERE status = 'pending' OR (status = 'retry' AND next_attempt_at IS NOT NULL AND next_attempt_at <= ?)
      ORDER BY created_at ASC LIMIT ?
    `).all(now, limit) as any[];
    return rows.map((r) => ({
      ...r,
      payload: r.payload ? JSON.parse(r.payload) : null,
    }));
  }

  public claimWebhookDeliveryForSending(id: string): boolean {
    const res = this.db.prepare(`
      UPDATE webhook_deliveries 
      SET status = 'sending' 
      WHERE id = ? AND (status = 'pending' OR status = 'retry')
    `).run(id);
    return res.changes > 0;
  }

  public reclaimStaleWebhookDeliveries(timeoutMinutes = 2): number {
    const cutoff = new Date(Date.now() - timeoutMinutes * 60000).toISOString();
    const res = this.db.prepare(`
      UPDATE webhook_deliveries 
      SET status = 'retry', next_attempt_at = NULL 
      WHERE status = 'sending' AND created_at < ?
    `).run(cutoff);
    return res.changes;
  }

  public markWebhookDelivered(id: string, statusCode: number, responseBody: string, durationMs: number): boolean {
    const res = this.db.prepare(`
      UPDATE webhook_deliveries 
      SET status = 'delivered', response_status = ?, response_body = ?, duration_ms = ?
      WHERE id = ?
    `).run(statusCode, responseBody.slice(0, 1000), durationMs, id);
    return res.changes > 0;
  }

  public markWebhookFailed(
    id: string,
    error: string,
    statusCode?: number,
    durationMs?: number,
    responseBody?: string,
    retryAfterSec?: number
  ): boolean {
    const attemptsRow = this.db.prepare('SELECT attempts FROM webhook_deliveries WHERE id = ?').get(id) as any;
    const currentAttempts = (attemptsRow?.attempts || 0) + 1;
    const willRetry = currentAttempts < 4 && !retryAfterSec;
    const nextAttempt = willRetry 
      ? new Date(Date.now() + Math.pow(2, currentAttempts) * 2000).toISOString()
      : null;

    const res = this.db.prepare(`
      UPDATE webhook_deliveries 
      SET status = @status,
          error_message = @error_message,
          response_status = @response_status,
          duration_ms = @duration_ms,
          response_body = @response_body,
          attempts = @attempts,
          next_attempt_at = @next_attempt_at
      WHERE id = @id
    `).run({
      status: willRetry ? 'retry' : 'failed',
      error_message: error,
      response_status: statusCode || null,
      duration_ms: durationMs !== undefined ? durationMs : null,
      response_body: responseBody ? responseBody.slice(0, 1000) : null,
      attempts: currentAttempts,
      next_attempt_at: nextAttempt,
      id,
    });
    return res.changes > 0;
  }

  public listWebhookDeliveries(instanceId?: string, limit = 50): WebhookDelivery[] {
    const query = instanceId
      ? 'SELECT * FROM webhook_deliveries WHERE instance_id = ? ORDER BY created_at DESC LIMIT ?'
      : 'SELECT * FROM webhook_deliveries ORDER BY created_at DESC LIMIT ?';
    const rows = (instanceId
      ? this.db.prepare(query).all(instanceId, limit)
      : this.db.prepare(query).all(limit)) as any[];
    return rows.map((r) => ({
      ...r,
      payload: r.payload ? (typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload) : null,
    }));
  }

  public getWebhookStats(instanceId: string) {
    const row = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'retry' THEN 1 ELSE 0 END) as retrying,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        AVG(CASE WHEN duration_ms IS NOT NULL THEN duration_ms ELSE NULL END) as avg_latency_ms
      FROM webhook_deliveries
      WHERE instance_id = ?
    `).get(instanceId) as any;
    return {
      total: Number(row?.total || 0),
      delivered: Number(row?.delivered || 0),
      failed: Number(row?.failed || 0),
      retrying: Number(row?.retrying || 0),
      pending: Number(row?.pending || 0),
      avg_latency_ms: Math.round(Number(row?.avg_latency_ms || 0)),
    };
  }

  public retryWebhookDelivery(deliveryId: string): boolean {
    const res = this.db.prepare(`
      UPDATE webhook_deliveries 
      SET status = 'pending', error_message = NULL, next_attempt_at = NULL 
      WHERE id = ?
    `).run(deliveryId);
    return res.changes > 0;
  }

  public clearWebhookDeliveries(instanceId: string): boolean {
    const res = this.db.prepare('DELETE FROM webhook_deliveries WHERE instance_id = ?').run(instanceId);
    return res.changes > 0;
  }

  // --- AI Runs ---

  public createAiRun(params: {
    instance_id: string;
    message_id?: string;
    provider: string;
    model?: string;
  }): string {
    const id = crypto.randomUUID();
    const now = this.now();
    this.db.prepare(`
      INSERT INTO ai_runs (id, instance_id, message_id, provider, model, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'processing', ?)
    `).run(id, params.instance_id, params.message_id || null, params.provider, params.model || null, now);
    return id;
  }

  public updateAiRun(id: string, updates: {
    status: string;
    response_text?: string;
    prompt_tokens?: number;
    completion_tokens?: number;
    duration_ms?: number;
    error_message?: string;
  }): boolean {
    const res = this.db.prepare(`
      UPDATE ai_runs 
      SET status = @status, response_text = @response_text, prompt_tokens = @prompt_tokens,
          completion_tokens = @completion_tokens, duration_ms = @duration_ms, error_message = @error_message
      WHERE id = @id
    `).run({
      id,
      status: updates.status,
      response_text: updates.response_text || null,
      prompt_tokens: updates.prompt_tokens || null,
      completion_tokens: updates.completion_tokens || null,
      duration_ms: updates.duration_ms || null,
      error_message: updates.error_message || null,
    });
    return res.changes > 0;
  }

  public listAiRuns(instanceId: string, limit = 20): AiRun[] {
    return this.db.prepare('SELECT * FROM ai_runs WHERE instance_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(instanceId, limit) as AiRun[];
  }

  // --- Event Logs ---

  public addEventLog(instanceId: string, eventType: string, payload: any): void {
    try {
      const id = crypto.randomUUID();
      this.db.prepare(`
        INSERT INTO event_logs (id, instance_id, event_type, payload, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, instanceId, eventType, JSON.stringify(payload ?? {}), this.now());
    } catch (err: any) {
      if (err?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || err?.message?.includes('FOREIGN KEY')) {
        // Instance might have been deleted, safely ignore
        return;
      }
      throw err;
    }
  }

  public listEventLogs(instanceId: string, limit = 50): any[] {
    const rows = this.db.prepare(`
      SELECT * FROM event_logs WHERE instance_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(instanceId, limit) as any[];
    return rows.map((r) => ({
      ...r,
      payload: r.payload ? JSON.parse(r.payload) : null,
    }));
  }

  // --- Contacts & Anti-Spam ---

  public upsertContact(params: {
    instance_id: string;
    remote_jid: string;
    name?: string | null;
  }): Contact {
    const id = crypto.randomUUID();
    const now = this.now();
    this.db.prepare(`
      INSERT INTO contacts (id, instance_id, remote_jid, name, opted_out, created_at)
      VALUES (@id, @instance_id, @remote_jid, @name, 0, @created_at)
      ON CONFLICT(instance_id, remote_jid) DO UPDATE SET
        name = COALESCE(@name, name)
    `).run({
      id,
      instance_id: params.instance_id,
      remote_jid: params.remote_jid,
      name: params.name || null,
      created_at: now,
    });

    const row = this.db.prepare('SELECT * FROM contacts WHERE instance_id = ? AND remote_jid = ?')
      .get(params.instance_id, params.remote_jid) as any;
    return { ...row, opted_out: Boolean(row.opted_out) };
  }

  public getContact(instanceId: string, remoteJid: string): Contact | null {
    const row = this.db.prepare('SELECT * FROM contacts WHERE instance_id = ? AND remote_jid = ?')
      .get(instanceId, remoteJid) as any;
    if (!row) return null;
    return { ...row, opted_out: Boolean(row.opted_out) };
  }

  public setContactOptOut(instanceId: string, remoteJid: string, optedOut: boolean): boolean {
    const res = this.db.prepare(`
      UPDATE contacts SET opted_out = ? WHERE instance_id = ? AND remote_jid = ?
    `).run(optedOut ? 1 : 0, instanceId, remoteJid);
    return res.changes > 0;
  }

  public listContacts(instanceId: string): Contact[] {
    const rows = this.db.prepare('SELECT * FROM contacts WHERE instance_id = ? ORDER BY created_at DESC')
      .all(instanceId) as any[];
    return rows.map((r) => ({ ...r, opted_out: Boolean(r.opted_out) }));
  }

  public countRecentOutbound(instanceId: string, remoteJid: string, sinceIso: string): number {
    const row = this.db.prepare(`
      SELECT COUNT(*) as count FROM outbound_messages 
      WHERE instance_id = ? AND remote_jid = ? AND status = 'sent' AND sent_at >= ?
    `).get(instanceId, remoteJid, sinceIso) as any;
    return row?.count || 0;
  }

  // --- Auto Reply Rules ---

  public createAutoReplyRule(params: {
    instance_id: string;
    name: string;
    match_type?: 'exact' | 'contains' | 'regex' | 'starts_with';
    match_value: string;
    reply_text: string;
  }): AutoReplyRule {
    const id = crypto.randomUUID();
    const now = this.now();
    this.db.prepare(`
      INSERT INTO auto_reply_rules (id, instance_id, name, match_type, match_value, reply_text, enabled, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(id, params.instance_id, params.name, params.match_type || 'exact', params.match_value, params.reply_text, now);

    return this.db.prepare('SELECT * FROM auto_reply_rules WHERE id = ?').get(id) as AutoReplyRule;
  }

  public listAutoReplyRules(instanceId: string): AutoReplyRule[] {
    const rows = this.db.prepare('SELECT * FROM auto_reply_rules WHERE instance_id = ? ORDER BY created_at DESC')
      .all(instanceId) as any[];
    return rows.map((r) => ({ ...r, enabled: Boolean(r.enabled) }));
  }

  public deleteAutoReplyRule(id: string): boolean {
    const res = this.db.prepare('DELETE FROM auto_reply_rules WHERE id = ?').run(id);
    return res.changes > 0;
  }

  // --- Baileys Auth Store in SQLite ---

  public getAuthCreds(instanceId: string): string | null {
    const row = this.db.prepare('SELECT data FROM baileys_auth_creds WHERE instance_id = ?').get(instanceId) as any;
    return row?.data || null;
  }

  public saveAuthCreds(instanceId: string, data: string): void {
    this.db.prepare(`
      INSERT INTO baileys_auth_creds (instance_id, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(instance_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
    `).run(instanceId, data, this.now());
  }

  public getAuthKeys(instanceId: string, keyType: string, keyIds: string[]): Map<string, string> {
    const map = new Map<string, string>();
    if (keyIds.length === 0) return map;

    const placeholders = keyIds.map(() => '?').join(',');
    const rows = this.db.prepare(`
      SELECT key_id, data FROM baileys_auth_keys 
      WHERE instance_id = ? AND key_type = ? AND key_id IN (${placeholders})
    `).all(instanceId, keyType, ...keyIds) as any[];

    for (const row of rows) {
      map.set(row.key_id, row.data);
    }
    return map;
  }

  public listAuthKeys(instanceId: string): Array<{ key_type: string; key_id: string; data: string }> {
    return this.db.prepare('SELECT key_type, key_id, data FROM baileys_auth_keys WHERE instance_id = ?')
      .all(instanceId) as any[];
  }

  public saveAuthKeys(instanceId: string, updates: Array<{ keyType: string; keyId: string; data: string | null }>): void {
    if (updates.length === 0) return;
    const now = this.now();
    const insertStmt = this.db.prepare(`
      INSERT INTO baileys_auth_keys (instance_id, key_type, key_id, data, updated_at)
      VALUES (@instanceId, @keyType, @keyId, @data, @now)
      ON CONFLICT(instance_id, key_type, key_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
    `);
    const deleteStmt = this.db.prepare(`
      DELETE FROM baileys_auth_keys WHERE instance_id = ? AND key_type = ? AND key_id = ?
    `);

    const tx = this.db.transaction(() => {
      for (const item of updates) {
        if (item.data) {
          insertStmt.run({
            instanceId,
            keyType: item.keyType,
            keyId: item.keyId,
            data: item.data,
            now,
          });
        } else {
          deleteStmt.run(instanceId, item.keyType, item.keyId);
        }
      }
    });

    tx();
  }

  public clearAuthState(instanceId: string): void {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM baileys_auth_creds WHERE instance_id = ?').run(instanceId);
      this.db.prepare('DELETE FROM baileys_auth_keys WHERE instance_id = ?').run(instanceId);
    });
    tx();
  }

  // --- API Keys ---

  public createApiKeyRecord(
    nameOrParams:
      | string
      | {
          name: string;
          keyHash: string;
          prefix: string;
          org_id?: string;
          scopes?: string[];
          allowed_ips?: string[];
          expires_at?: string | null;
        },
    keyHash?: string,
    prefix?: string,
    orgId?: string,
    scopes?: string[],
    allowedIps?: string[],
    expiresAt?: string | null
  ): string {
    const id = crypto.randomUUID();
    const now = this.now();

    let name: string;
    let hash: string;
    let pref: string;
    let org: string;
    let sc: string[];
    let ips: string[] | null = null;
    let exp: string | null = null;

    if (typeof nameOrParams === 'object') {
      name = nameOrParams.name;
      hash = nameOrParams.keyHash;
      pref = nameOrParams.prefix;
      org = nameOrParams.org_id || this.getDefaultOrgId();
      sc = nameOrParams.scopes || ['*'];
      ips = nameOrParams.allowed_ips || null;
      exp = nameOrParams.expires_at || null;
    } else {
      name = nameOrParams;
      hash = keyHash!;
      pref = prefix!;
      org = orgId || this.getDefaultOrgId();
      sc = scopes || ['*'];
      ips = allowedIps || null;
      exp = expiresAt || null;
    }

    this.db.prepare(`
      INSERT INTO api_keys (id, org_id, name, key_hash, prefix, scopes, allowed_ips, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      org,
      name,
      hash,
      pref,
      JSON.stringify(sc),
      ips ? JSON.stringify(ips) : null,
      exp,
      now
    );
    return id;
  }

  public verifyApiKeyHash(keyHash: string): (ApiKey & { org_id: string; scopes: string[] }) | null {
    const row = this.db.prepare('SELECT * FROM api_keys WHERE key_hash = ?').get(keyHash) as any;
    if (!row) return null;

    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      return null;
    }

    this.db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(this.now(), row.id);

    let parsedScopes: string[] = ['*'];
    try {
      if (row.scopes) parsedScopes = JSON.parse(row.scopes);
    } catch {
      parsedScopes = ['*'];
    }

    let parsedIps: string[] | null = null;
    try {
      if (row.allowed_ips) parsedIps = JSON.parse(row.allowed_ips);
    } catch {
      parsedIps = null;
    }

    return {
      ...row,
      org_id: row.org_id || this.getDefaultOrgId(),
      scopes: parsedScopes,
      allowed_ips: parsedIps,
    };
  }

  public listApiKeys(orgId?: string): any[] {
    if (orgId) {
      return this.db
        .prepare('SELECT id, org_id, name, prefix, scopes, allowed_ips, expires_at, created_at, last_used_at FROM api_keys WHERE org_id = ? ORDER BY created_at DESC')
        .all(orgId);
    }
    return this.db
      .prepare('SELECT id, org_id, name, prefix, scopes, allowed_ips, expires_at, created_at, last_used_at FROM api_keys ORDER BY created_at DESC')
      .all();
  }

  public deleteApiKey(id: string): boolean {
    const res = this.db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
    return res.changes > 0;
  }

  // --- Global System Settings (AI API Keys & Integrations) ---

  public setSystemSetting(key: string, value: string): void {
    const encrypted = encrypt(value);
    const now = this.now();
    this.db.prepare(`
      INSERT INTO system_settings (key, value_encrypted, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value_encrypted = excluded.value_encrypted, updated_at = excluded.updated_at
    `).run(key, encrypted, now);
  }

  public getSystemSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value_encrypted FROM system_settings WHERE key = ?').get(key) as any;
    if (!row?.value_encrypted) return null;
    try {
      return decrypt(row.value_encrypted);
    } catch {
      return null;
    }
  }

  public deleteSystemSetting(key: string): boolean {
    const res = this.db.prepare('DELETE FROM system_settings WHERE key = ?').run(key);
    return res.changes > 0;
  }

  public listSystemSettings(): Record<string, { configured: boolean; masked: string; updated_at: string }> {
    const rows = this.db.prepare('SELECT key, value_encrypted, updated_at FROM system_settings').all() as any[];
    const result: Record<string, { configured: boolean; masked: string; updated_at: string }> = {};
    for (const row of rows) {
      let masked = '';
      try {
        const val = decrypt(row.value_encrypted);
        if (val) {
          masked = val.length > 8 ? `${val.slice(0, 4)}...${val.slice(-4)}` : '••••••••';
        }
      } catch {
        masked = '••••••••';
      }
      result[row.key] = {
        configured: Boolean(row.value_encrypted),
        masked,
        updated_at: row.updated_at,
      };
    }
    return result;
  }
}

// Global Singleton Export
export const db = new GatewayDatabase();
