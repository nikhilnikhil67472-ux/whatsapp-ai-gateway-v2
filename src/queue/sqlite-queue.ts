import crypto from 'crypto';
import { db } from '../db/database.js';
import { WhatsAppEngineManager } from '../whatsapp/manager.js';
import {
  sendText,
  sendMedia,
  sendAudio,
  sendLocation,
  sendContact,
  sendSticker,
  sendPoll,
} from '../whatsapp/sender.js';
import { deliverWebhook } from '../webhooks/dispatcher.js';
import { config } from '../config/index.js';

// --- Zero-Width Space Micro-Variations & Duplicate Hash Guard ---
export const ZERO_WIDTH_CHARS = ['\u200B', '\u200C', '\u200D', '\uFEFF'];

export function stripZeroWidthSpaces(text: string): string {
  return text.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
}

/**
 * Injects invisible zero-width space micro-variations into text
 * to disperse cryptographic/content hash while displaying identically to the user.
 */
export function injectZeroWidthMicroVariations(text: string): string {
  if (!text || text.length === 0) return text;
  const clean = stripZeroWidthSpaces(text);
  if (clean.length === 0) return text;

  // Insert 1 to 3 zero-width character micro-variations
  const numVariations = 1 + Math.floor(Math.random() * 3);
  let result = clean;

  const spaceIndices: number[] = [];
  for (let i = 0; i < result.length; i++) {
    if (result[i] === ' ') spaceIndices.push(i);
  }

  for (let v = 0; v < numVariations; v++) {
    const zw = ZERO_WIDTH_CHARS[Math.floor(Math.random() * ZERO_WIDTH_CHARS.length)];
    if (spaceIndices.length > 0) {
      const targetSpaceIdx = spaceIndices[Math.floor(Math.random() * spaceIndices.length)];
      result = result.slice(0, targetSpaceIdx + 1) + zw + result.slice(targetSpaceIdx + 1);
    } else {
      result = result + zw;
    }
  }

  if (!/[\u200B\u200C\u200D\uFEFF]/.test(result)) {
    result += ZERO_WIDTH_CHARS[0];
  }

  return result;
}

export interface ColdDuplicateTracker {
  canonicalHash: string;
  consecutiveColdCount: number;
  distinctJids: Set<string>;
}

const coldDuplicateTrackers = new Map<string, ColdDuplicateTracker>();

export function getColdDuplicateTracker(instanceId: string): ColdDuplicateTracker | undefined {
  return coldDuplicateTrackers.get(instanceId);
}

export function resetColdDuplicateStreak(instanceId: string): void {
  const tracker = coldDuplicateTrackers.get(instanceId);
  if (tracker) {
    tracker.consecutiveColdCount = 0;
    tracker.distinctJids.clear();
  }
}

export function resetAllColdDuplicateTrackers(): void {
  coldDuplicateTrackers.clear();
}

/**
 * Applies the content guard: prevents sending identical text payloads to 5+
 * different cold numbers in a row by dispersing content hashes with invisible zero-width spaces.
 */
export function applyDuplicateHashGuard(instanceId: string, remoteJid: string, text: string): string {
  const canonical = stripZeroWidthSpaces(text).trim();
  const hash = crypto.createHash('sha256').update(canonical).digest('hex');

  let tracker = coldDuplicateTrackers.get(instanceId);
  if (tracker && tracker.canonicalHash === hash) {
    tracker.consecutiveColdCount++;
    tracker.distinctJids.add(remoteJid);
  } else {
    tracker = {
      canonicalHash: hash,
      consecutiveColdCount: 1,
      distinctJids: new Set([remoteJid]),
    };
    coldDuplicateTrackers.set(instanceId, tracker);
  }

  // When identical text is sent to 5+ cold numbers, inject zero-width micro-variations
  if (tracker.consecutiveColdCount >= 5 || tracker.distinctJids.size >= 5) {
    const varied = injectZeroWidthMicroVariations(text);
    console.log(`[Duplicate Hash Guard] Dispersed content hash for cold outbound on instance ${instanceId} (cold count: ${tracker.consecutiveColdCount}, distinct cold JIDs: ${tracker.distinctJids.size})`);
    return varied;
  }

  return text;
}

// --- Anti-Burst Pacing (Inter-message cooldown per instance) ---
export interface InstancePacingState {
  lastSentAt: number;
  lastWasCold: boolean;
}

const instancePacingStates = new Map<string, InstancePacingState>();

export function getInstancePacing(instanceId: string): InstancePacingState | undefined {
  return instancePacingStates.get(instanceId);
}

export function resetInstancePacing(instanceId?: string): void {
  if (instanceId) {
    instancePacingStates.delete(instanceId);
  } else {
    instancePacingStates.clear();
  }
}

export function calculateInterMessageCooldown(
  isWarm: boolean,
  prevWasCold: boolean,
  isTest = process.env.NODE_ENV === 'test' || Boolean(config.testingMode)
): number {
  if (isTest) return 0;
  // Between consecutive cold outbound messages: random(45s, 95s)
  if (!isWarm && prevWasCold) {
    const minMs = 45000;
    const maxMs = 95000;
    return minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
  }
  // For warm replies (or transition from cold to warm): random(6s, 14s)
  const minMs = 6000;
  const maxMs = 14000;
  return minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
}

export async function processWorkerCommandsQueue(): Promise<number> {
  db.reclaimStaleWorkerCommands(5);
  const pending = db.listPendingWorkerCommands(10);
  let processed = 0;

  for (const cmd of pending) {
    if (!db.markWorkerCommandProcessing(cmd.id)) continue;

    try {
      if (cmd.command === 'start') {
        await WhatsAppEngineManager.startInstance(cmd.instance_id);
      } else if (cmd.command === 'restart') {
        await WhatsAppEngineManager.restartInstance(cmd.instance_id, Boolean(cmd.payload?.purgeSession));
      } else if (cmd.command === 'stop') {
        await WhatsAppEngineManager.stopInstance(cmd.instance_id);
      } else if (cmd.command === 'logout') {
        await WhatsAppEngineManager.logoutInstance(cmd.instance_id);
      } else if (cmd.command === 'delete') {
        await WhatsAppEngineManager.deleteInstance(cmd.instance_id);
      }

      if (cmd.command !== 'delete') {
        db.completeWorkerCommand(cmd.id);
      }
      processed++;
    } catch (err: any) {
      db.failWorkerCommand(cmd.id, err?.message || 'Command failed');
    }
  }

  return processed;
}

export async function processOutboundMessagesQueue(targetInstanceId?: string): Promise<number> {
  db.reclaimStaleOutboundMessages(2);
  const pending = db.listPendingOutboundMessages(15, targetInstanceId);
  let processed = 0;

  for (const msg of pending) {
    if (!db.claimOutboundMessageForSending(msg.id)) {
      continue;
    }

    try {
      const instance = db.getInstance(msg.instance_id);
      if (!instance) {
        db.markOutboundMessageStatus(msg.id, 'failed', 'Instance does not exist');
        continue;
      }

      // Check contact opt-out
      const contact = db.getContact(instance.id, msg.remote_jid);
      if (contact?.opted_out) {
        db.markOutboundMessageStatus(msg.id, 'failed', 'Recipient has opted out');
        continue;
      }

      // Check rate limit per contact
      const rateLimit = instance.outbound_per_minute || config.defaultRateLimitPerMin;
      const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
      const recentCount = db.countRecentOutbound(instance.id, msg.remote_jid, oneMinuteAgo);
      if (recentCount >= rateLimit) {
        const nextAttempt = new Date(Date.now() + 10000).toISOString();
        db.markOutboundMessageStatus(msg.id, 'retry', `Rate limit exceeded (${rateLimit}/min)`, nextAttempt);
        continue;
      }

      // Sandbox Mode: simulate send without real WhatsApp socket
      if (instance.sandbox_mode) {
        db.markOutboundMessageStatus(msg.id, 'simulated');
        db.addMessage({
          instance_id: instance.id,
          conversation_id: msg.conversation_id || undefined,
          remote_jid: msg.remote_jid,
          whatsapp_message_id: `sandbox_${msg.id}`,
          from_me: true,
          direction: 'outbound',
          message_type: msg.reply_type,
          text_content: msg.text_content,
          raw_payload: msg.payload,
        });
        processed++;
        continue;
      }

      // Check SIM Warm-up Schedule Engine (gradual ramping to protect against WhatsApp anti-spam bans)
      const warmup = db.checkAndIncrementWarmupLimit(instance.id, msg.remote_jid);
      if (!warmup.allowed) {
        const nextAttempt = new Date(Date.now() + 3600000 * 4).toISOString();
        const errMessage = warmup.errorCode === 'COLD_WARMUP_LIMIT_REACHED'
          ? `[COLD_WARMUP_LIMIT_REACHED] Cold outbound limit reached for Day ${warmup.warmupDay} (${warmup.limit} msgs/day). Delayed to protect number from WhatsApp ban.`
          : `SIM Warm-up Day ${warmup.warmupDay} limit reached (${warmup.limit} msgs/day). Delayed to protect number from WhatsApp ban.`;
        db.markOutboundMessageStatus(
          msg.id,
          'retry',
          errMessage,
          nextAttempt
        );
        continue;
      }

      // Determine contact warmth & test environment
      const isWarm = db.isContactWarm(instance.id, msg.remote_jid);
      const isTest = process.env.NODE_ENV === 'test' || Boolean(config.testingMode);

      // Duplicate Hash Guard: prevent sending identical text payloads to 5+ cold numbers in a row
      if (!isWarm && msg.text_content && msg.text_content.trim().length > 0) {
        msg.text_content = applyDuplicateHashGuard(instance.id, msg.remote_jid, msg.text_content);
      } else if (isWarm) {
        resetColdDuplicateStreak(instance.id);
      }

      // Anti-Burst Pacing: enforce minimum inter-message cooldown per instance
      const prevPacing = instancePacingStates.get(instance.id);
      if (prevPacing) {
        const requiredCooldown = calculateInterMessageCooldown(isWarm, prevPacing.lastWasCold, isTest);
        const elapsed = Date.now() - prevPacing.lastSentAt;
        if (elapsed < requiredCooldown) {
          const waitMs = requiredCooldown - elapsed;
          if (waitMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, waitMs));
          }
        }
      }

      let result: any;
      if (msg.reply_type === 'text') {
        result = await sendText({
          instanceId: instance.id,
          remoteJid: msg.remote_jid,
          text: msg.text_content || '',
          quotedMessageId: msg.quoted_message_id || undefined,
        });
      } else if (msg.reply_type === 'media') {
        result = await sendMedia({
          instanceId: instance.id,
          remoteJid: msg.remote_jid,
          mediaUrl: msg.media_url || undefined,
          base64: msg.payload?.base64,
          mediaType: (msg.media_type as any) || 'image',
          mimeType: msg.mime_type || undefined,
          caption: msg.text_content || undefined,
          fileName: msg.payload?.fileName,
          isPtv: Boolean(msg.payload?.isPtv),
          quotedMessageId: msg.quoted_message_id || undefined,
        });
      } else if (msg.reply_type === 'audio') {
        result = await sendAudio({
          instanceId: instance.id,
          remoteJid: msg.remote_jid,
          audioUrl: msg.media_url || undefined,
          base64: msg.payload?.base64,
          mimeType: msg.mime_type || undefined,
          isVoiceNote: msg.payload?.isVoiceNote !== undefined ? Boolean(msg.payload.isVoiceNote) : true,
          quotedMessageId: msg.quoted_message_id || undefined,
        });
      } else if (msg.reply_type === 'location') {
        result = await sendLocation({
          instanceId: instance.id,
          remoteJid: msg.remote_jid,
          latitude: msg.payload?.latitude || 0,
          longitude: msg.payload?.longitude || 0,
          name: msg.payload?.name,
          address: msg.payload?.address,
          quotedMessageId: msg.quoted_message_id || undefined,
        });
      } else if (msg.reply_type === 'contact') {
        result = await sendContact({
          instanceId: instance.id,
          remoteJid: msg.remote_jid,
          displayName: msg.payload?.displayName || 'Contact',
          vcard: msg.payload?.vcard || '',
          quotedMessageId: msg.quoted_message_id || undefined,
        });
      } else if (msg.reply_type === 'sticker') {
        result = await sendSticker({
          instanceId: instance.id,
          remoteJid: msg.remote_jid,
          stickerUrl: msg.media_url || undefined,
          base64: msg.payload?.base64,
          packName: msg.payload?.packName || msg.payload?.pack_name,
          authorName: msg.payload?.authorName || msg.payload?.author_name,
          quotedMessageId: msg.quoted_message_id || undefined,
        });
      } else if (msg.reply_type === 'poll') {
        result = await sendPoll({
          instanceId: instance.id,
          remoteJid: msg.remote_jid,
          name: msg.text_content || msg.payload?.name || msg.payload?.poll_name || 'Poll',
          values: msg.payload?.values || msg.payload?.poll_values || msg.payload?.options || [],
          selectableCount: msg.payload?.selectableCount || msg.payload?.selectable_count || 1,
          quotedMessageId: msg.quoted_message_id || undefined,
        });
      }

      instancePacingStates.set(instance.id, {
        lastSentAt: Date.now(),
        lastWasCold: !isWarm,
      });

      db.markOutboundMessageStatus(msg.id, 'sent');
      db.addMessage({
        instance_id: instance.id,
        conversation_id: msg.conversation_id || undefined,
        remote_jid: msg.remote_jid,
        whatsapp_message_id: result?.key?.id || `outbound_${msg.id}`,
        from_me: true,
        direction: 'outbound',
        message_type: msg.reply_type,
        text_content: msg.text_content,
        raw_payload: result,
      });

      processed++;
    } catch (err: any) {
      db.decrementWarmupLimit(msg.instance_id, msg.remote_jid);
      instancePacingStates.set(msg.instance_id, {
        lastSentAt: Date.now(),
        lastWasCold: !db.isContactWarm(msg.instance_id, msg.remote_jid),
      });
      const attempts = (msg.attempts || 0) + 1;
      if (attempts < 3) {
        const backoffMs = Math.pow(2, attempts) * 2000;
        const nextAttempt = new Date(Date.now() + backoffMs).toISOString();
        db.markOutboundMessageStatus(msg.id, 'retry', err?.message || 'Outbound send error', nextAttempt);
      } else {
        db.markOutboundMessageStatus(msg.id, 'failed', err?.message || 'Outbound send error');
      }
    }
  }

  return processed;
}

export async function processWebhookDeliveriesQueue(): Promise<number> {
  db.reclaimStaleWebhookDeliveries(2);
  const pending = db.listPendingWebhookDeliveries(20);
  let processed = 0;

  for (const delivery of pending) {
    if (!db.claimWebhookDeliveryForSending(delivery.id)) continue;
    const instance = db.getInstance(delivery.instance_id);
    const success = await deliverWebhook(delivery, instance?.webhook_secret);
    if (success) processed++;
  }

  return processed;
}
