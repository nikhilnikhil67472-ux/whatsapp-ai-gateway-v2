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

export async function processOutboundMessagesQueue(): Promise<number> {
  db.reclaimStaleOutboundMessages(2);
  const pending = db.listPendingOutboundMessages(15);
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
      const warmup = db.checkAndIncrementWarmupLimit(instance.id);
      if (!warmup.allowed) {
        const nextAttempt = new Date(Date.now() + 3600000 * 4).toISOString();
        db.markOutboundMessageStatus(
          msg.id,
          'retry',
          `SIM Warm-up Day ${warmup.warmupDay} limit reached (${warmup.limit} msgs/day). Delayed to protect number from WhatsApp ban.`,
          nextAttempt
        );
        continue;
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
