import { db } from '../db/database.js';
import { WhatsAppEngineManager } from '../whatsapp/manager.js';
import {
  processWorkerCommandsQueue,
  processOutboundMessagesQueue,
  processWebhookDeliveriesQueue,
  resetInstancePacing,
  resetAllColdDuplicateTrackers,
} from '../queue/sqlite-queue.js';
import { clearAllInactivityTimers } from '../whatsapp/sender.js';
import { config } from '../config/index.js';

import { hasRegisteredAuthState } from '../whatsapp/session-store.js';

let isRunning = false;
let pollTimer: NodeJS.Timeout | null = null;
let lastHealthCheck = 0;

export async function startWorker(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  console.log('[Worker] Starting WhatsApp AI Gateway background worker daemon...');

  // Auto-start active & registered instances on worker launch with staggered delay (anti-thundering herd)
  const instances = db.listInstances();
  let startupOffsetMs = 0;
  for (const inst of instances) {
    const isRegistered = hasRegisteredAuthState(inst.id);
    const shouldStart = ['connected', 'reconnecting', 'connecting'].includes(inst.status) || (inst.status === 'disconnected' && isRegistered);
    if (shouldStart) {
      const delay = startupOffsetMs;
      startupOffsetMs += 500;
      setTimeout(() => {
        console.log(`[Worker] Auto-starting instance (staggered +${delay}ms): ${inst.instance_name} (${inst.id})`);
        WhatsAppEngineManager.startInstance(inst.id).catch((err) => {
          console.warn(`[Worker] Auto-start failed for ${inst.instance_name}:`, err?.message);
        });
      }, delay);
    }
  }

  const poll = async () => {
    if (!isRunning) return;

    try {
      await processWorkerCommandsQueue();
      await processOutboundMessagesQueue();
      await processWebhookDeliveriesQueue();

      // Health check interval
      if (Date.now() - lastHealthCheck > config.healthCheckIntervalMs) {
        lastHealthCheck = Date.now();
        await WhatsAppEngineManager.runHealthCheck();
      }
    } catch (err: any) {
      console.error('[Worker Loop Error]:', err?.message);
    } finally {
      if (isRunning) {
        pollTimer = setTimeout(poll, config.workerPollIntervalMs);
      }
    }
  };

  poll();
}

export async function stopWorker(): Promise<void> {
  if (!isRunning) return;
  isRunning = false;
  if (pollTimer) clearTimeout(pollTimer);
  console.log('[Worker] Stopping worker and closing WhatsApp sockets...');
  clearAllInactivityTimers();
  resetInstancePacing();
  resetAllColdDuplicateTrackers();
  await WhatsAppEngineManager.shutdownAll();
  console.log('[Worker] Worker stopped cleanly.');
}

// If executed directly as standalone process
const isDirectRun = process.argv[1]?.endsWith('worker/index.ts') || process.argv[1]?.endsWith('worker/index.js');
if (isDirectRun) {
  startWorker().catch((err) => {
    console.error('[Worker Fatal]:', err);
    process.exit(1);
  });

  const shutdown = async (signal: string) => {
    console.log(`[Worker] Received ${signal}. Shutting down...`);
    await stopWorker();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}
