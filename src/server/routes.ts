import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db/database.js';
import { WhatsAppEngineManager } from '../whatsapp/manager.js';
import { generateApiKey, hashApiKey } from '../security/crypto.js';
import {
  createJwtToken,
  verifyJwtToken,
  hashPassword,
  verifyPassword,
} from '../security/auth.js';
import { config } from '../config/index.js';
import { deliverWebhook } from '../webhooks/dispatcher.js';
import {
  sendReaction,
  sendPresence,
  checkWhatsAppNumber,
  sendSticker,
  sendPoll,
  editMessage,
  deleteMessage,
  readMessages,
} from '../whatsapp/sender.js';
import * as groupOps from '../whatsapp/groups.js';
import { instanceEventStream } from '../whatsapp/events.js';
import { handleMcpRequest } from './mcp.js';

export interface AuthenticatedUser {
  id: string;
  org_id: string;
  role: 'owner' | 'admin' | 'member';
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      apiKey?: any;
    }
  }
}

export const apiRouter = Router();

// --- Public Health Endpoint ---
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

export function normalizeWebhookUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let trimmed = raw.trim();
  if (!trimmed) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    if (/^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/i.test(trimmed)) {
      trimmed = `http://${trimmed}`;
    } else {
      trimmed = `https://${trimmed}`;
    }
  }

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

const webhookUrlSchema = z.preprocess((arg) => {
  if (arg === '' || arg === null || arg === undefined) return null;
  return normalizeWebhookUrl(arg);
}, z.string().url().nullable().optional());

const outboundPerMinSchema = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return 30;
  const num = Number(val);
  return isNaN(num) ? 30 : Math.max(1, Math.min(300, num));
}, z.number().min(1).max(300)).optional();

// --- Validation Schemas ---
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  organization_name: z.string().min(2).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createInstanceSchema = z.object({
  instance_name: z.string().min(2).max(64),
  proxy_url: z.string().optional().nullable(),
  pairing_phone: z.string().optional().nullable(),
  ai_enabled: z.boolean().optional(),
  ai_provider: z.enum(['openai', 'anthropic', 'n8n', 'webhook']).optional(),
  ai_model: z.string().optional().nullable(),
  ai_system_prompt: z.string().optional().nullable(),
  webhook_url: webhookUrlSchema,
  webhook_secret: z.string().optional().nullable(),
  n8n_webhook_url: webhookUrlSchema,
  sandbox_mode: z.boolean().optional(),
});

const updateInstanceSchema = z.object({
  proxy_url: z.string().optional().nullable(),
  pairing_phone: z.string().optional().nullable(),
  ai_enabled: z.boolean().optional(),
  ai_provider: z.enum(['openai', 'anthropic', 'n8n', 'webhook']).optional(),
  ai_model: z.string().optional().nullable(),
  ai_system_prompt: z.string().optional().nullable(),
  webhook_url: webhookUrlSchema,
  webhook_secret: z.string().optional().nullable(),
  n8n_webhook_url: webhookUrlSchema,
  reject_calls: z.boolean().optional(),
  ignore_groups: z.boolean().optional(),
  sandbox_mode: z.boolean().optional(),
  outbound_per_minute: outboundPerMinSchema,
  events_config: z.record(z.object({
    enabled: z.boolean().optional(),
    webhook_url: z.string().nullable().optional(),
  })).optional(),
});

const sendMessageSchema = z.object({
  instance_id: z.string().min(1),
  remote_jid: z.string().min(5),
  type: z.enum(['text', 'media', 'audio', 'location', 'contact', 'sticker', 'poll']).default('text'),
  text: z.string().optional(),
  body: z.string().optional(),
  message: z.string().optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  media_url: z.preprocess((arg) => (arg === '' ? null : arg), z.string().nullable().optional()),
  base64: z.string().optional(),
  media_type: z.enum(['image', 'video', 'document']).optional(),
  mime_type: z.string().optional(),
  caption: z.string().optional(),
  file_name: z.string().optional(),
  is_ptv: z.boolean().optional(),
  is_voice_note: z.boolean().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  contact_name: z.string().optional(),
  vcard: z.string().optional(),
  pack_name: z.string().optional(),
  author_name: z.string().optional(),
  poll_name: z.string().optional(),
  poll_values: z.array(z.string()).optional(),
  selectable_count: z.number().optional(),
  quoted_message_id: z.string().optional(),
});

const pairingCodeSchema = z.object({
  phone_number: z.string().min(8).max(25),
});

// --- Public Auth Endpoints ---

apiRouter.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const body = registerSchema.parse(req.body);
    const existing = db.getUserByEmail(body.email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const org = db.createOrganization({
      name: body.organization_name || `${body.name}'s Workspace`,
    });

    const user = db.createUser({
      org_id: org.id,
      email: body.email,
      password_hash: hashPassword(body.password),
      name: body.name,
      role: 'owner',
    });

    const token = createJwtToken({
      userId: user.id,
      orgId: org.id,
      role: user.role,
      email: user.email,
    });

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      organization: org,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.errors || err.message || 'Invalid registration request' });
  }
});

apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = db.getUserByEmail(body.email);
    if (!user || !verifyPassword(body.password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const org = db.getOrganization(user.org_id);
    const token = createJwtToken({
      userId: user.id,
      orgId: user.org_id,
      role: user.role,
      email: user.email,
    });

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      organization: org,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.errors || err.message || 'Invalid login request' });
  }
});

apiRouter.post('/auth/demo-login', async (req: Request, res: Response) => {
  const defaultOrgId = db.getDefaultOrgId();
  const org = db.getOrganization(defaultOrgId);
  const admin = db.getUserByEmail('admin@gateway.local');
  if (!admin) {
    return res.status(500).json({ error: 'Default admin user not configured' });
  }

  const token = createJwtToken({
    userId: admin.id,
    orgId: admin.org_id,
    role: admin.role,
    email: admin.email,
  });

  res.json({
    token,
    user: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    organization: org,
  });
});

// --- Strict Authentication Middleware ---
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || req.headers['x-api-key'];

  if (!authHeader) {
    return res.status(401).json({
      error: 'Unauthorized: Authentication required. Provide Bearer token or x-api-key header.',
    });
  }

  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Empty token or API key' });
  }

  // 1. Admin Master Key check
  if (config.adminApiKey && token === config.adminApiKey) {
    req.user = {
      id: 'usr_admin',
      org_id: db.getDefaultOrgId(),
      role: 'owner',
      email: 'admin@gateway.local',
    };
    return next();
  }

  // 2. JWT Session Token check
  const jwtPayload = verifyJwtToken(token);
  if (jwtPayload) {
    req.user = {
      id: jwtPayload.userId,
      org_id: jwtPayload.orgId,
      role: jwtPayload.role,
      email: jwtPayload.email,
    };
    return next();
  }

  // 3. Scoped API Key check
  const hash = hashApiKey(token);
  const keyRecord = db.verifyApiKeyHash(hash);
  if (keyRecord) {
    req.apiKey = keyRecord;
    req.user = {
      id: 'api_client',
      org_id: keyRecord.org_id || db.getDefaultOrgId(),
      role: 'admin',
      email: 'api@gateway.local',
    };
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized: Invalid or expired API Key or token' });
}

// Backward compatibility alias
export const requireApiKey = authenticate;

// Mount authentication on all subsequent endpoints
apiRouter.use(authenticate);

// --- Protected Current User Endpoint ---
apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const user = req.user!;
  const org = db.getOrganization(user.org_id);
  res.json({ user, organization: org });
});

// --- Instance Endpoints (Multi-Tenant Scoped) ---

// Create Instance
apiRouter.post('/instances', async (req: Request, res: Response) => {
  try {
    const body = createInstanceSchema.parse(req.body);
    const existing = db.getInstanceByIdentifier(body.instance_name);
    if (existing) {
      return res.status(409).json({ error: `Instance name '${body.instance_name}' already exists` });
    }

    const instance = db.createInstance({
      org_id: req.user?.org_id,
      instance_name: body.instance_name,
      proxy_url: body.proxy_url || undefined,
      pairing_phone: body.pairing_phone || undefined,
      ai_enabled: body.ai_enabled,
      ai_provider: body.ai_provider,
      ai_model: body.ai_model || undefined,
      ai_system_prompt: body.ai_system_prompt || undefined,
      webhook_url: body.webhook_url || undefined,
      webhook_secret: body.webhook_secret || undefined,
      n8n_webhook_url: body.n8n_webhook_url || undefined,
      sandbox_mode: body.sandbox_mode,
    });

    db.enqueueWorkerCommand(instance.id, 'start');
    res.status(201).json(instance);
  } catch (err: any) {
    res.status(400).json({ error: err.errors || err.message });
  }
});

// List Instances (scoped to user organization)
apiRouter.get('/instances', (req: Request, res: Response) => {
  const list = db.listInstances(req.user?.org_id);
  res.json(list);
});

// Get Instance by ID or Name
apiRouter.get('/instances/:id', (req: Request, res: Response) => {
  const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });
  res.json(instance);
});

// Update Instance Settings
apiRouter.patch('/instances/:id', (req: Request, res: Response) => {
  try {
    const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    const updates = updateInstanceSchema.parse(req.body);
    db.updateInstance(instance.id, updates);
    res.json(db.getInstance(instance.id));
  } catch (err: any) {
    res.status(400).json({ error: err.errors || err.message });
  }
});

// Delete Instance
apiRouter.delete('/instances/:id', async (req: Request, res: Response) => {
  const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  if (config.unifiedMode) {
    await WhatsAppEngineManager.deleteInstance(instance.id);
  } else {
    db.enqueueWorkerCommand(instance.id, 'delete');
  }
  res.json({ success: true, message: 'Instance deletion completed' });
});

apiRouter.post('/instances/:id/delete', async (req: Request, res: Response) => {
  const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  if (config.unifiedMode) {
    await WhatsAppEngineManager.deleteInstance(instance.id);
  } else {
    db.enqueueWorkerCommand(instance.id, 'delete');
  }
  res.json({ success: true, message: 'Instance deletion completed' });
});

// Instance Status & QR Code Polling
apiRouter.get('/instances/:id/status', (req: Request, res: Response) => {
  const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  const runtime = WhatsAppEngineManager.getRuntimeState(instance.id);
  res.json({
    id: instance.id,
    instance_name: instance.instance_name,
    status: instance.status,
    phone_number: instance.phone_number,
    push_name: instance.push_name,
    qr_base64: instance.qr_base64,
    qr_updated_at: instance.qr_updated_at,
    last_connection_at: instance.last_connection_at,
    proxy_url: instance.proxy_url,
    pairing_phone: instance.pairing_phone,
    runtime,
    ai_enabled: instance.ai_enabled,
    ai_provider: instance.ai_provider,
    ai_model: instance.ai_model,
    ai_system_prompt: instance.ai_system_prompt,
    n8n_webhook_url: instance.n8n_webhook_url,
    webhook_url: instance.webhook_url,
    webhook_secret: instance.webhook_secret,
    reject_calls: instance.reject_calls,
    ignore_groups: instance.ignore_groups,
    sandbox_mode: instance.sandbox_mode,
    outbound_per_minute: instance.outbound_per_minute,
  });
});

// Control Actions (Start, Restart, Stop, Logout)
apiRouter.post('/instances/:id/start', (req: Request, res: Response) => {
  const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  db.enqueueWorkerCommand(instance.id, 'start');
  res.json({ success: true, message: 'Start command queued' });
});

apiRouter.post('/instances/:id/restart', (req: Request, res: Response) => {
  const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  db.enqueueWorkerCommand(instance.id, 'restart', { purgeSession: req.body?.purge_session === true });
  res.json({ success: true, message: 'Restart command queued' });
});

apiRouter.post('/instances/:id/stop', (req: Request, res: Response) => {
  const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  db.enqueueWorkerCommand(instance.id, 'stop');
  res.json({ success: true, message: 'Stop command queued' });
});

apiRouter.post('/instances/:id/logout', (req: Request, res: Response) => {
  const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  db.enqueueWorkerCommand(instance.id, 'logout');
  res.json({ success: true, message: 'Logout command queued' });
});

// 8-Digit Phone Pairing Code Generator
apiRouter.post('/instances/:id/pairing-code', async (req: Request, res: Response) => {
  try {
    const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    const body = pairingCodeSchema.parse(req.body);
    const cleanPhone = body.phone_number.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 8) {
      return res.status(400).json({ error: 'Invalid phone number format. Provide country code + number.' });
    }

    db.updateInstance(instance.id, { pairing_phone: cleanPhone });
    const code = await WhatsAppEngineManager.requestPairingCode(instance.id, cleanPhone);

    res.json({
      success: true,
      instance_id: instance.id,
      instance_name: instance.instance_name,
      phone_number: cleanPhone,
      pairing_code: code,
      instructions: 'Open WhatsApp on your phone > Settings > Linked Devices > Link with phone number instead > Enter this code.',
    });
  } catch (err: any) {
    if (err instanceof z.ZodError || err.errors) {
      return res.status(400).json({ error: err.errors || err.message });
    }
    res.status(500).json({ error: err?.message || 'Failed to generate pairing code' });
  }
});

// --- WhatsApp Messaging Endpoints ---

// Send Message
apiRouter.post('/whatsapp/send', async (req: Request, res: Response) => {
  try {
    const body = sendMessageSchema.parse(req.body);
    const instance = db.getInstanceByIdentifier(body.instance_id, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    let remoteJid = body.remote_jid.trim();
    if (remoteJid.includes('@s.whatsapp.net')) {
      remoteJid = `${remoteJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    } else if (remoteJid.includes('@lid')) {
      remoteJid = remoteJid.replace(/\s+/g, '');
    } else if (!remoteJid.includes('@')) {
      remoteJid = `${remoteJid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    }

    const outboundId = db.enqueueOutboundMessage({
      instance_id: instance.id,
      remote_jid: remoteJid,
      reply_type: body.type,
      text_content: body.text || body.body || body.message || body.description || body.content || body.caption || body.poll_name || null,
      media_url: body.media_url || null,
      media_type: body.media_type || null,
      mime_type: body.mime_type || null,
      quoted_message_id: body.quoted_message_id || null,
      payload: {
        base64: body.base64 || null,
        fileName: body.file_name || null,
        isPtv: Boolean(body.is_ptv),
        isVoiceNote: body.is_voice_note !== undefined ? Boolean(body.is_voice_note) : undefined,
        latitude: body.latitude || null,
        longitude: body.longitude || null,
        displayName: body.contact_name || null,
        vcard: body.vcard || null,
        packName: body.pack_name || null,
        authorName: body.author_name || null,
        pollName: body.poll_name || null,
        values: body.poll_values || null,
        selectableCount: body.selectable_count || null,
      },
    });

    res.status(202).json({
      success: true,
      message_id: outboundId,
      status: 'pending',
    });
  } catch (err: any) {
    res.status(400).json({ error: err.errors || err.message });
  }
});

// Deprecated Interactive Message Sender (Buttons & Lists)
apiRouter.post('/whatsapp/send-interactive', (req: Request, res: Response) => {
  res.status(410).json({
    success: false,
    error: 'Interactive buttons and lists are deprecated due to WhatsApp restrictions on non-Cloud accounts. Use /api/v1/whatsapp/send-poll for rock-solid interactive selections on all WhatsApp accounts.',
    migration: {
      recommended_endpoint: '/api/v1/whatsapp/send-poll',
      example: {
        instance_id: req.body?.instance_id || 'default',
        remote_jid: req.body?.remote_jid || '1234567890@s.whatsapp.net',
        name: req.body?.text || 'Please choose an option:',
        values: ['Option 1', 'Option 2'],
      },
    },
  });
});

// Send Emoji Reaction
apiRouter.post('/whatsapp/reaction', async (req: Request, res: Response) => {
  try {
    const { instance_id, remote_jid, message_id, emoji } = req.body;
    if (!instance_id || !remote_jid || !message_id || !emoji) {
      return res.status(400).json({ error: 'instance_id, remote_jid, message_id, and emoji are required' });
    }
    const instance = db.getInstanceByIdentifier(instance_id, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    let cleanJid = remote_jid.trim();
    if (!cleanJid.includes('@')) cleanJid = `${cleanJid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

    const result = await sendReaction({
      instanceId: instance.id,
      remoteJid: cleanJid,
      messageId: message_id,
      emoji,
    });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to send reaction' });
  }
});

// Update Presence (composing, recording, available, unavailable, paused)
apiRouter.post('/whatsapp/presence', async (req: Request, res: Response) => {
  try {
    const { instance_id, remote_jid, presence } = req.body;
    if (!instance_id || !presence) {
      return res.status(400).json({ error: 'instance_id and presence are required' });
    }
    const instance = db.getInstanceByIdentifier(instance_id, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    let cleanJid = remote_jid ? remote_jid.trim() : undefined;
    if (cleanJid && !cleanJid.includes('@')) cleanJid = `${cleanJid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

    await sendPresence({
      instanceId: instance.id,
      remoteJid: cleanJid,
      presence,
    });
    res.json({ success: true, presence });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update presence' });
  }
});

// Check if a Phone Number is registered on WhatsApp
apiRouter.post('/whatsapp/check-number', async (req: Request, res: Response) => {
  try {
    const { instance_id, phone } = req.body;
    if (!instance_id || !phone) {
      return res.status(400).json({ error: 'instance_id and phone are required' });
    }
    const instance = db.getInstanceByIdentifier(instance_id, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    const check = await checkWhatsAppNumber(instance.id, phone);
    res.json({ success: true, ...check });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to check number' });
  }
});

apiRouter.get('/instances/:id/check-number/:phone', async (req: Request, res: Response) => {
  try {
    const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    const check = await checkWhatsAppNumber(instance.id, req.params.phone);
    res.json({ success: true, ...check });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to check number' });
  }
});

// Send Sticker (WebP + custom EXIF pack & author)
apiRouter.post('/whatsapp/send-sticker', async (req: Request, res: Response) => {
  try {
    const { instance_id, remote_jid, sticker_url, base64, pack_name, author_name, quoted_message_id } = req.body;
    if (!instance_id || !remote_jid || (!sticker_url && !base64)) {
      return res.status(400).json({ error: 'instance_id, remote_jid, and either sticker_url or base64 are required' });
    }
    const instance = db.getInstanceByIdentifier(instance_id, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    let cleanJid = remote_jid.trim();
    if (!cleanJid.includes('@')) cleanJid = `${cleanJid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

    const result = await sendSticker({
      instanceId: instance.id,
      remoteJid: cleanJid,
      stickerUrl: sticker_url,
      base64,
      packName: pack_name,
      authorName: author_name,
      quotedMessageId: quoted_message_id,
    });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to send sticker' });
  }
});

// Send Interactive Poll
apiRouter.post('/whatsapp/send-poll', async (req: Request, res: Response) => {
  try {
    const { instance_id, remote_jid, name, values, selectable_count, quoted_message_id } = req.body;
    if (!instance_id || !remote_jid || !name || !Array.isArray(values) || values.length < 2) {
      return res.status(400).json({ error: 'instance_id, remote_jid, name, and values (minimum 2 options) are required' });
    }
    const instance = db.getInstanceByIdentifier(instance_id, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    let cleanJid = remote_jid.trim();
    if (!cleanJid.includes('@')) cleanJid = `${cleanJid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

    const result = await sendPoll({
      instanceId: instance.id,
      remoteJid: cleanJid,
      name,
      values,
      selectableCount: Number(selectable_count) || 1,
      quotedMessageId: quoted_message_id,
    });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to send poll' });
  }
});

// Edit Message
apiRouter.post('/whatsapp/messages/edit', async (req: Request, res: Response) => {
  try {
    const { instance_id, remote_jid, message_id, new_text } = req.body;
    if (!instance_id || !remote_jid || !message_id || !new_text) {
      return res.status(400).json({ error: 'instance_id, remote_jid, message_id, and new_text are required' });
    }
    const instance = db.getInstanceByIdentifier(instance_id, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    let cleanJid = remote_jid.trim();
    if (!cleanJid.includes('@')) cleanJid = `${cleanJid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

    const result = await editMessage({
      instanceId: instance.id,
      remoteJid: cleanJid,
      messageId: message_id,
      newText: new_text,
    });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to edit message' });
  }
});

// Delete Message (Revoke for Everyone)
apiRouter.post('/whatsapp/messages/delete', async (req: Request, res: Response) => {
  try {
    const { instance_id, remote_jid, message_id } = req.body;
    if (!instance_id || !remote_jid || !message_id) {
      return res.status(400).json({ error: 'instance_id, remote_jid, and message_id are required' });
    }
    const instance = db.getInstanceByIdentifier(instance_id, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    let cleanJid = remote_jid.trim();
    if (!cleanJid.includes('@')) cleanJid = `${cleanJid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

    const result = await deleteMessage({
      instanceId: instance.id,
      remoteJid: cleanJid,
      messageId: message_id,
    });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete message' });
  }
});

// Read Receipts (Mark as Read / Blue Ticks)
apiRouter.post('/whatsapp/messages/read', async (req: Request, res: Response) => {
  try {
    const { instance_id, remote_jid, message_ids } = req.body;
    if (!instance_id || !remote_jid || !Array.isArray(message_ids) || message_ids.length === 0) {
      return res.status(400).json({ error: 'instance_id, remote_jid, and message_ids (array) are required' });
    }
    const instance = db.getInstanceByIdentifier(instance_id, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    let cleanJid = remote_jid.trim();
    if (!cleanJid.includes('@')) cleanJid = `${cleanJid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

    const result = await readMessages({
      instanceId: instance.id,
      remoteJid: cleanJid,
      messageIds: message_ids,
    });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to mark messages as read' });
  }
});

// --- WhatsApp Group Administration Suite ---

// Create Group
apiRouter.post('/whatsapp/groups', async (req: Request, res: Response) => {
  try {
    const { instance_id, subject, participants } = req.body;
    if (!instance_id || !subject || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'instance_id, subject, and participants (array) are required' });
    }
    const instance = db.getInstanceByIdentifier(instance_id, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    const group = await groupOps.createGroup({
      instanceId: instance.id,
      subject,
      participants,
    });
    res.status(201).json({ success: true, group });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create group' });
  }
});

// Get Group Metadata
apiRouter.get('/whatsapp/groups/:groupJid', async (req: Request, res: Response) => {
  try {
    const instanceId = req.query.instance_id as string || req.headers['x-instance-id'] as string;
    if (!instanceId) return res.status(400).json({ error: 'instance_id query param or x-instance-id header required' });
    const instance = db.getInstanceByIdentifier(instanceId, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    const metadata = await groupOps.getGroupMetadata(instance.id, req.params.groupJid);
    res.json({ success: true, metadata });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch group metadata' });
  }
});

// Update Group Subject (Title)
apiRouter.patch('/whatsapp/groups/:groupJid/subject', async (req: Request, res: Response) => {
  try {
    const { instance_id, subject } = req.body;
    if (!instance_id || !subject) return res.status(400).json({ error: 'instance_id and subject are required' });
    const instance = db.getInstanceByIdentifier(instance_id, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    const result = await groupOps.updateGroupSubject({
      instanceId: instance.id,
      groupJid: req.params.groupJid,
      subject,
    });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update group subject' });
  }
});

// Update Group Description
apiRouter.patch('/whatsapp/groups/:groupJid/description', async (req: Request, res: Response) => {
  try {
    const { instance_id, description } = req.body;
    if (!instance_id || description === undefined) return res.status(400).json({ error: 'instance_id and description are required' });
    const instance = db.getInstanceByIdentifier(instance_id, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    const result = await groupOps.updateGroupDescription({
      instanceId: instance.id,
      groupJid: req.params.groupJid,
      description,
    });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update group description' });
  }
});

// Manage Group Participants (Add, Remove, Promote, Demote)
apiRouter.post('/whatsapp/groups/:groupJid/participants', async (req: Request, res: Response) => {
  try {
    const { instance_id, participants, action } = req.body;
    if (!instance_id || !Array.isArray(participants) || !['add', 'remove', 'promote', 'demote'].includes(action)) {
      return res.status(400).json({ error: 'instance_id, participants (array), and action (add|remove|promote|demote) are required' });
    }
    const instance = db.getInstanceByIdentifier(instance_id, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    const result = await groupOps.updateGroupParticipants({
      instanceId: instance.id,
      groupJid: req.params.groupJid,
      participants,
      action,
    });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update group participants' });
  }
});

// Get Group Invite Code
apiRouter.get('/whatsapp/groups/:groupJid/invite-code', async (req: Request, res: Response) => {
  try {
    const instanceId = req.query.instance_id as string || req.headers['x-instance-id'] as string;
    if (!instanceId) return res.status(400).json({ error: 'instance_id query param or x-instance-id header required' });
    const instance = db.getInstanceByIdentifier(instanceId, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    const invite = await groupOps.getGroupInviteCode({
      instanceId: instance.id,
      groupJid: req.params.groupJid,
    });
    res.json({ success: true, ...invite });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get group invite code' });
  }
});

// Revoke Group Invite Code
apiRouter.post('/whatsapp/groups/:groupJid/revoke-invite', async (req: Request, res: Response) => {
  try {
    const { instance_id } = req.body;
    if (!instance_id) return res.status(400).json({ error: 'instance_id is required' });
    const instance = db.getInstanceByIdentifier(instance_id, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    const invite = await groupOps.revokeGroupInviteCode({
      instanceId: instance.id,
      groupJid: req.params.groupJid,
    });
    res.json({ success: true, ...invite });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to revoke group invite code' });
  }
});

// Join Group Via Invite Code
apiRouter.post('/whatsapp/groups/join', async (req: Request, res: Response) => {
  try {
    const { instance_id, invite_code } = req.body;
    if (!instance_id || !invite_code) return res.status(400).json({ error: 'instance_id and invite_code are required' });
    const instance = db.getInstanceByIdentifier(instance_id, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    const result = await groupOps.joinGroupViaInvite({
      instanceId: instance.id,
      inviteCode: invite_code,
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to join group via invite' });
  }
});

// Update Group Settings (announcement mode, locked mode)
apiRouter.patch('/whatsapp/groups/:groupJid/settings', async (req: Request, res: Response) => {
  try {
    const { instance_id, setting } = req.body;
    if (!instance_id || !['announcement', 'not_announcement', 'locked', 'unlocked'].includes(setting)) {
      return res.status(400).json({ error: 'instance_id and valid setting (announcement|not_announcement|locked|unlocked) required' });
    }
    const instance = db.getInstanceByIdentifier(instance_id, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    const result = await groupOps.updateGroupSetting({
      instanceId: instance.id,
      groupJid: req.params.groupJid,
      setting,
    });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update group setting' });
  }
});

// Leave Group
apiRouter.post('/whatsapp/groups/:groupJid/leave', async (req: Request, res: Response) => {
  try {
    const { instance_id } = req.body;
    if (!instance_id) return res.status(400).json({ error: 'instance_id is required' });
    const instance = db.getInstanceByIdentifier(instance_id, req.user?.org_id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    const result = await groupOps.leaveGroup({
      instanceId: instance.id,
      groupJid: req.params.groupJid,
    });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to leave group' });
  }
});

// --- Real-Time Server-Sent Events (SSE) Streaming ---
apiRouter.get('/instances/:id/events/stream', (req: Request, res: Response) => {
  const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial connect acknowledgement
  res.write(`data: ${JSON.stringify({ event: 'stream.connected', instance_id: instance.id, timestamp: new Date().toISOString() })}\n\n`);

  const onEvent = (payload: any) => {
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      // client connection closed
    }
  };

  instanceEventStream.on(instance.id, onEvent);

  req.on('close', () => {
    instanceEventStream.off(instance.id, onEvent);
  });
});

// --- Model Context Protocol (MCP) Streamable HTTP Endpoint ---
apiRouter.post('/mcp', handleMcpRequest);



// Granular Events Trigger Matrix Endpoints
apiRouter.get('/instances/:id/events-config', (req: Request, res: Response) => {
  const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });
  res.json({
    instance_id: instance.id,
    events: instance.events_config,
  });
});

apiRouter.patch('/instances/:id/events-config', (req: Request, res: Response) => {
  const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  const currentConfig = { ...instance.events_config };
  const incoming = req.body.events || req.body;

  for (const [key, val] of Object.entries(incoming)) {
    if (typeof val === 'object' && val !== null) {
      const v = val as any;
      (currentConfig as any)[key] = {
        enabled: Boolean(v.enabled),
        webhook_url: v.webhook_url ? normalizeWebhookUrl(v.webhook_url) : null,
      };
    }
  }

  db.updateInstance(instance.id, { events_config: currentConfig });
  res.json({
    success: true,
    instance_id: instance.id,
    events: currentConfig,
  });
});

// Messages & Conversations History
apiRouter.get('/instances/:id/messages', (req: Request, res: Response) => {
  const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  const limit = parseInt((req.query.limit as string) || '50', 10);
  res.json(db.listMessages(instance.id, limit));
});

apiRouter.get('/instances/:id/conversations', (req: Request, res: Response) => {
  const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  res.json(db.listConversations(instance.id));
});

apiRouter.get('/instances/:id/events', (req: Request, res: Response) => {
  const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  const limit = parseInt((req.query.limit as string) || '50', 10);
  res.json(db.listEventLogs(instance.id, limit));
});

// --- Webhook Inspector & Delivery Management ---
apiRouter.get('/instances/:id/webhooks/deliveries', (req: Request, res: Response) => {
  const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  const limit = parseInt((req.query.limit as string) || '50', 10);
  const deliveries = db.listWebhookDeliveries(instance.id, limit);
  const stats = db.getWebhookStats(instance.id);

  res.json({
    instance_id: instance.id,
    webhook_url: instance.webhook_url,
    n8n_webhook_url: instance.n8n_webhook_url,
    has_secret: Boolean(instance.webhook_secret),
    stats,
    deliveries,
  });
});

apiRouter.post('/instances/:id/webhooks/test', async (req: Request, res: Response) => {
  const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  const rawUrl =
    req.body?.target_url ||
    (req.body?.target_type === 'n8n' ? instance.n8n_webhook_url : instance.webhook_url || instance.n8n_webhook_url);
  const targetUrl = normalizeWebhookUrl(rawUrl);
  if (!targetUrl) {
    return res.status(400).json({ error: 'No valid webhook URL provided or configured on this instance' });
  }

  if (req.body?.save === true) {
    if (req.body?.target_type === 'n8n') {
      db.updateInstance(instance.id, { n8n_webhook_url: targetUrl });
    } else {
      db.updateInstance(instance.id, { webhook_url: targetUrl });
    }
  }

  const deliveryId = db.enqueueWebhookDelivery({
    instance_id: instance.id,
    event_type: 'webhook.test',
    target_url: targetUrl,
    payload: {
      event: 'webhook.test',
      instance: { id: instance.id, name: instance.instance_name },
      timestamp: new Date().toISOString(),
      ping: 'WhatsApp AI Gateway v2 Test Ping',
    },
  });

  if (!db.claimWebhookDeliveryForSending(deliveryId)) {
    return res.status(500).json({ error: 'Failed to claim test delivery record' });
  }

  const delivery = db.getWebhookDelivery(deliveryId);
  if (!delivery) {
    return res.status(500).json({ error: 'Failed to create test delivery record' });
  }

  const success = await deliverWebhook(delivery, instance.webhook_secret);
  const updatedDelivery = db.getWebhookDelivery(deliveryId);
  const updatedInstance = db.getInstance(instance.id);

  res.json({
    success,
    delivery: updatedDelivery,
    instance: updatedInstance,
  });
});

apiRouter.post('/instances/:id/webhooks/deliveries/:deliveryId/retry', async (req: Request, res: Response) => {
  const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  const delivery = db.getWebhookDelivery(req.params.deliveryId);
  if (!delivery || delivery.instance_id !== instance.id) {
    return res.status(404).json({ error: 'Webhook delivery not found' });
  }

  db.retryWebhookDelivery(delivery.id);
  const updatedDelivery = db.getWebhookDelivery(delivery.id);
  if (updatedDelivery) {
    const success = await deliverWebhook(updatedDelivery, instance.webhook_secret);
    return res.json({
      success,
      delivery: db.getWebhookDelivery(delivery.id),
    });
  }

  res.json({ success: true, message: 'Queued for retry' });
});

apiRouter.delete('/instances/:id/webhooks/deliveries', (req: Request, res: Response) => {
  const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  db.clearWebhookDeliveries(instance.id);
  res.json({ success: true, message: 'Webhook history cleared' });
});

// --- Auto Reply Rules ---
apiRouter.post('/instances/:id/auto-replies', (req: Request, res: Response) => {
  const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  const { name, match_type, match_value, reply_text } = req.body;
  if (!name || !match_value || !reply_text) {
    return res.status(400).json({ error: 'name, match_value, and reply_text are required' });
  }

  const rule = db.createAutoReplyRule({
    instance_id: instance.id,
    name,
    match_type: match_type || 'exact',
    match_value,
    reply_text,
  });
  res.status(201).json(rule);
});

apiRouter.get('/instances/:id/auto-replies', (req: Request, res: Response) => {
  const instance = db.getInstanceByIdentifier(req.params.id, req.user?.org_id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  res.json(db.listAutoReplyRules(instance.id));
});

apiRouter.delete('/instances/:id/auto-replies/:ruleId', (req: Request, res: Response) => {
  const deleted = db.deleteAutoReplyRule(req.params.ruleId);
  res.json({ success: deleted });
});

// --- Scoped API Key Management ---
apiRouter.post('/api-keys', (req: Request, res: Response) => {
  const name = req.body.name || 'API Key';
  const scopes = req.body.scopes || ['*'];
  const allowed_ips = req.body.allowed_ips || null;
  const expires_at = req.body.expires_at || null;
  const { key, hash } = generateApiKey();

  const id = db.createApiKeyRecord({
    name,
    keyHash: hash,
    prefix: key.slice(0, 8),
    org_id: req.user?.org_id,
    scopes,
    allowed_ips,
    expires_at,
  });

  res.status(201).json({
    id,
    name,
    api_key: key,
    prefix: key.slice(0, 8),
    scopes,
  });
});

apiRouter.get('/api-keys', (req: Request, res: Response) => {
  res.json(db.listApiKeys(req.user?.org_id));
});

apiRouter.delete('/api-keys/:id', (req: Request, res: Response) => {
  res.json({ success: db.deleteApiKey(req.params.id) });
});
