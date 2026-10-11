import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from '../config/index.js';
import { apiRouter } from './routes.js';
import { renderDashboardHtml } from './dashboard-ui.js';
import { renderDocsHtml } from './docs-ui.js';
import { db } from '../db/database.js';

export const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve decrypted media files
const mediaDir = path.resolve(process.cwd(), 'data', 'media');
if (!fs.existsSync(mediaDir)) {
  fs.mkdirSync(mediaDir, { recursive: true });
}
app.use('/media', express.static(mediaDir));

// Health Check
app.get('/health', (req: Request, res: Response) => {
  try {
    const rawDb = db.getRawDb();
    const dbOk = rawDb.prepare('SELECT 1 as ok').get() as any;
    res.json({
      status: 'healthy',
      version: '2.0.0',
      database: dbOk?.ok === 1 ? 'connected' : 'error',
      uptime_sec: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ status: 'unhealthy', error: err?.message });
  }
});

// Lightweight ping endpoint for uptime monitors
app.get('/ping', (req: Request, res: Response) => {
  res.type('text/plain').send('pong');
});

// Interactive Dashboard UI
app.get('/', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(renderDashboardHtml());
});

app.get('/dashboard', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(renderDashboardHtml());
});

// Mount REST API
app.use('/api/v1', apiRouter);

// OpenAPI / Swagger Documentation endpoint
app.get('/api-docs/ui', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(renderDocsHtml());
});

app.get('/api-docs', (req: Request, res: Response) => {
  if (
    (req.headers.accept?.includes('text/html') && !req.headers.accept?.includes('application/json') && req.query.format !== 'json') ||
    req.query.format === 'html'
  ) {
    res.setHeader('Content-Type', 'text/html');
    return res.send(renderDocsHtml());
  }

  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'WhatsApp AI Gateway v2 API',
      version: '2.0.0',
      description: 'Production-ready WhatsApp Web AI Gateway connecting Baileys to OpenAI, Anthropic, n8n, and custom webhooks.',
    },
    paths: {
      '/api/v1/instances': {
        get: { summary: 'List all WhatsApp instances' },
        post: { summary: 'Create a new WhatsApp instance' },
      },
      '/api/v1/instances/{id}/status': {
        get: { summary: 'Get instance connection status and live Base64 QR code' },
      },
      '/api/v1/whatsapp/send': {
        post: { summary: 'Send text, media, voice note, location, contact, sticker, or poll' },
      },
      '/api/v1/whatsapp/reaction': {
        post: { summary: 'Send emoji reaction to a message' },
      },
      '/api/v1/whatsapp/presence': {
        post: { summary: 'Update WhatsApp presence status (composing, recording, available, paused)' },
      },
      '/api/v1/whatsapp/check-number': {
        post: { summary: 'Verify if a phone number is registered on WhatsApp' },
      },
      '/api/v1/instances/{id}/pairing-code': {
        post: { summary: 'Request 8-digit phone pairing code (no QR camera scan)' },
      },
      '/api/v1/instances/{id}/events-config': {
        get: { summary: 'Get granular events triggers & custom webhook routing matrix' },
        patch: { summary: 'Update granular events triggers & custom webhook routing matrix' },
      },
      '/api/v1/instances/{id}/start': { post: { summary: 'Start WhatsApp connection' } },
      '/api/v1/instances/{id}/restart': { post: { summary: 'Restart instance / generate fresh QR' } },
      '/api/v1/instances/{id}/stop': { post: { summary: 'Stop instance connection' } },
      '/api/v1/instances/{id}/logout': { post: { summary: 'Logout and wipe session' } },
      '/api/v1/whatsapp/send-sticker': {
        post: { summary: 'Send WebP sticker with EXIF metadata (pack name & author)' },
      },
      '/api/v1/whatsapp/send-poll': {
        post: { summary: 'Create and send interactive multi-choice poll' },
      },
      '/api/v1/whatsapp/messages/edit': {
        post: { summary: 'Edit sent message text within WhatsApp allowed window' },
      },
      '/api/v1/whatsapp/messages/delete': {
        post: { summary: 'Delete message for everyone (revoke)' },
      },
      '/api/v1/whatsapp/messages/read': {
        post: { summary: 'Send read receipts (blue ticks)' },
      },
      '/api/v1/whatsapp/groups': {
        post: { summary: 'Create a new WhatsApp group' },
      },
      '/api/v1/whatsapp/groups/{groupJid}': {
        get: { summary: 'Get group metadata and participant roster' },
      },
      '/api/v1/whatsapp/groups/{groupJid}/subject': {
        patch: { summary: 'Update group subject title' },
      },
      '/api/v1/whatsapp/groups/{groupJid}/description': {
        patch: { summary: 'Update group description topic' },
      },
      '/api/v1/whatsapp/groups/{groupJid}/participants': {
        post: { summary: 'Add, remove, promote, or demote participants' },
      },
      '/api/v1/whatsapp/groups/{groupJid}/invite-code': {
        get: { summary: 'Get group invite code and join URL' },
      },
      '/api/v1/whatsapp/groups/{groupJid}/revoke-invite': {
        post: { summary: 'Revoke and rotate group invite code' },
      },
      '/api/v1/whatsapp/groups/join': {
        post: { summary: 'Join group using invite code' },
      },
      '/api/v1/whatsapp/groups/{groupJid}/settings': {
        patch: { summary: 'Update announcement and locked settings' },
      },
      '/api/v1/whatsapp/groups/{groupJid}/leave': {
        post: { summary: 'Leave group' },
      },
      '/api/v1/instances/{id}/events/stream': {
        get: { summary: 'Real-time Server-Sent Events (SSE) stream for instant event listening' },
      },
      '/api/v1/mcp': {
        post: { summary: 'Model Context Protocol (MCP) Streamable HTTP endpoint for AI agents (Claude, Cursor, Windsurf)' },
      },
    },
  };

  res.json(openApiSpec);
});

export function startWebServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, config.host, () => {
      console.log(`[Web Server] WhatsApp AI Gateway v2 running at http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`);
      console.log(`[Web Server] Dashboard UI: http://localhost:${config.port}/dashboard`);
      console.log(`[Web Server] REST API Base: http://localhost:${config.port}/api/v1`);
      resolve();
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n[FATAL] Port ${config.port} is already in use by another process.`);
        console.error(`[FATAL] Specify a different port using the PORT environment variable (e.g., PORT=3000 or PORT=8080).\n`);
      } else if (err.code === 'EACCES') {
        console.error(`\n[FATAL] Permission denied binding to ${config.host}:${config.port}.`);
        console.error(`[FATAL] Ports below 1024 require elevated privileges on Unix/Linux systems. Run with sudo or set PORT=3000/8080.\n`);
      }
      reject(err);
    });
  });
}

// Standalone execution
const isDirectRun = process.argv[1]?.endsWith('server/index.ts') || process.argv[1]?.endsWith('server/index.js');
if (isDirectRun) {
  startWebServer().catch((err) => {
    console.error('[Web Server Fatal]:', err);
    process.exit(1);
  });
}
