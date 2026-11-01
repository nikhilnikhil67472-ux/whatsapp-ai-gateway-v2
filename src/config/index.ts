import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env from project root if exists
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const isTesting =
  process.env.TESTING_MODE === 'true' ||
  process.env.NODE_ENV === 'test' ||
  process.env.npm_lifecycle_event === 'test' ||
  process.execArgv.includes('--test') ||
  process.argv.some((arg) => arg.includes('test'));

if (isTesting && (!process.env.NODE_ENV || process.env.NODE_ENV === 'development')) {
  process.env.NODE_ENV = 'test';
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number.isInteger(parseInt(process.env.PORT || '3000', 10)) ? parseInt(process.env.PORT || '3000', 10) : 3000,
  host: process.env.HOST || '0.0.0.0',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  unifiedMode: process.env.UNIFIED_MODE !== 'false', // Default to true for easy single-process run
  testingMode: isTesting,

  // SQLite DB
  sqliteDbPath: process.env.SQLITE_DB_PATH
    ? path.resolve(process.cwd(), process.env.SQLITE_DB_PATH)
    : path.resolve(process.cwd(), 'data', 'gateway.db'),

  // Media Storage (defaults to 'media' subfolder alongside SQLite database or MEDIA_STORAGE_PATH)
  mediaStoragePath: process.env.MEDIA_STORAGE_PATH
    ? path.resolve(process.cwd(), process.env.MEDIA_STORAGE_PATH)
    : path.join(
        path.dirname(
          process.env.SQLITE_DB_PATH
            ? path.resolve(process.cwd(), process.env.SQLITE_DB_PATH)
            : path.resolve(process.cwd(), 'data', 'gateway.db')
        ),
        'media'
      ),

  // Security
  encryptionKey: process.env.ENCRYPTION_KEY || 'whatsapp-gateway-super-secret-key-32ch',
  adminApiKey: process.env.ADMIN_API_KEY || 'wag_admin_secret_key_12345',

  // Worker intervals
  workerPollIntervalMs: parseInt(process.env.WORKER_POLL_INTERVAL_MS || '2000', 10),
  healthCheckIntervalMs: parseInt(process.env.INSTANCE_HEALTH_INTERVAL_MS || '30000', 10),

  // WhatsApp / Baileys
  baileysLogLevel: (process.env.BAILEYS_LOG_LEVEL || 'warn') as 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace',
  outboundPresenceDelayMs: parseInt(process.env.OUTBOUND_PRESENCE_DELAY_MS || '400', 10),
  defaultRateLimitPerMin: parseInt(process.env.OUTBOUND_DEFAULT_RATE_LIMIT_PER_MIN || '30', 10),
  interactiveDeliveryMode: (process.env.INTERACTIVE_DELIVERY_MODE || 'native_only') as 'guaranteed' | 'native_only' | 'text_only',
  requireProxy: process.env.REQUIRE_PROXY === 'true',
  proxyCheckUrl: process.env.PROXY_CHECK_URL || 'https://api.ipify.org?format=json',

  // AI & Voice Transcription defaults
  groqApiKey: process.env.GROQ_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
  defaultAiSystemPrompt: process.env.DEFAULT_AI_SYSTEM_PROMPT || 
    'You are an intelligent, friendly AI WhatsApp assistant. Respond clearly, concisely, and helpfully. Keep messages easy to read on mobile devices.',
};
