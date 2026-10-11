import { config } from './config/index.js';
import { startWebServer } from './server/index.js';
import { startWorker, stopWorker } from './worker/index.js';

async function bootstrap() {
  console.log(`
  ==============================================================
   ⚡ WHATSAPP AI GATEWAY v2.0
   Autonomous WhatsApp Middleware & External AI Connector
  ==============================================================
   Environment:  ${config.env}
   Host / Port:  ${config.host}:${config.port}
   Database:     ${config.sqliteDbPath}
   Mode:         ${config.unifiedMode ? 'Unified (Web + Worker in single process)' : 'Decoupled'}
  ==============================================================
  `);

  // 1. Start HTTP Server (REST API + Dashboard)
  await startWebServer();

  // 2. Start Background Worker Daemon (Baileys WhatsApp connection manager + queue processor)
  if (config.unifiedMode) {
    await startWorker();
  }

  const shutdown = async (signal: string) => {
    console.log(`\n[Gateway] Received ${signal}. Initiating graceful shutdown...`);
    if (config.unifiedMode) {
      await stopWorker();
    }
    console.log('[Gateway] Shutdown complete. Goodbye!');
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('[Gateway Fatal Error]:', err);
  process.exit(1);
});
