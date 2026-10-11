import { WASocket, proto, jidNormalizedUser } from '@whiskeysockets/baileys';
import { EventEmitter } from 'events';
import { db } from '../db/database.js';
import { NormalizedMessage } from './types.js';
import { processAiReply } from '../ai/agent.js';
import { downloadInboundMedia } from './media.js';
import { deliverWebhook } from '../webhooks/dispatcher.js';
import { transcribeAudioFile } from '../ai/transcription.js';

export const instanceEventStream = new EventEmitter();
instanceEventStream.setMaxListeners(500);

export function normalizeBaileysMessage(raw: proto.IWebMessageInfo): NormalizedMessage | null {
  if (!raw || !raw.key) return null;

  // 1. Ignore phone system notification stubs and stub parameters
  const rawAny = raw as any;
  if (
    (rawAny.messageStubType !== undefined && rawAny.messageStubType !== null) ||
    (rawAny.stubType !== undefined && rawAny.stubType !== null) ||
    (rawAny.messageStubParameters && rawAny.messageStubParameters.length > 0)
  ) {
    return null;
  }

  const rawRemoteJid = raw.key.remoteJid;
  if (!rawRemoteJid) return null;
  const remoteJid = jidNormalizedUser(rawRemoteJid);

  // 2. Ignore WhatsApp status broadcasts, channels/newsletters, and broadcast lists
  if (
    remoteJid === 'status@broadcast' ||
    remoteJid.includes('@broadcast') ||
    remoteJid.includes('@newsletter') ||
    remoteJid === '0@s.whatsapp.net' ||
    remoteJid.startsWith('0@') ||
    Boolean(rawAny.broadcast)
  ) {
    return null;
  }

  // 3. Unwrap wrapped message containers (ephemeral, view-once, etc.)
  let message = raw.message;
  if (!message) return null;

  if (message.ephemeralMessage?.message) message = message.ephemeralMessage.message;
  if (message.viewOnceMessage?.message) message = message.viewOnceMessage.message;
  if (message.viewOnceMessageV2?.message) message = message.viewOnceMessageV2.message;
  if (message.documentWithCaptionMessage?.message) message = message.documentWithCaptionMessage.message;

  // 4. Ignore internal protocol messages, reactions, sync events, call stubs, device echoes, and security notifications
  const rawMsgObj = message as any;
  if (
    message.protocolMessage ||
    message.senderKeyDistributionMessage ||
    message.reactionMessage ||
    rawMsgObj.historySyncNotification ||
    rawMsgObj.peerDataOperationRequestMessage ||
    rawMsgObj.peerDataOperationRequestResponseMessage ||
    rawMsgObj.keepAliveMessage ||
    rawMsgObj.appStateSyncKeyShare ||
    rawMsgObj.appStateSyncKeyRequest ||
    rawMsgObj.notificationMessage ||
    rawMsgObj.deviceSentMessage ||
    rawMsgObj.bcallMessage ||
    rawMsgObj.call ||
    rawMsgObj.chat ||
    rawMsgObj.encReactionMessage ||
    rawMsgObj.encCommentMessage ||
    rawMsgObj.pollUpdateMessage ||
    rawMsgObj.pinInChatMessage
  ) {
    return null;
  }

  const isGroup = remoteJid.endsWith('@g.us');
  const fromMe = Boolean(raw.key.fromMe);
  const senderJid = raw.key.participant || remoteJid;
  const pushName = raw.pushName || null;
  const timestamp = Number(raw.messageTimestamp || Math.floor(Date.now() / 1000));

  let type: NormalizedMessage['type'] = 'other';
  let text: string | null = null;
  let caption: string | null = null;
  let mediaUrl: string | null = null;
  let mimetype: string | null = null;
  let quotedMessageId: string | null = null;

  let poll: NormalizedMessage['poll'] | undefined;

  if (message.conversation) {
    type = 'text';
    text = message.conversation;
  } else if (message.extendedTextMessage) {
    type = 'text';
    text = message.extendedTextMessage.text || null;
    quotedMessageId = message.extendedTextMessage.contextInfo?.stanzaId || null;
  } else if (message.buttonsResponseMessage) {
    type = 'text';
    text = message.buttonsResponseMessage.selectedDisplayText || message.buttonsResponseMessage.selectedButtonId || null;
  } else if (message.templateButtonReplyMessage) {
    type = 'text';
    text = message.templateButtonReplyMessage.selectedDisplayText || message.templateButtonReplyMessage.selectedId || null;
  } else if (message.listResponseMessage) {
    type = 'text';
    text = message.listResponseMessage.title || message.listResponseMessage.singleSelectReply?.selectedRowId || null;
  } else if (message.interactiveResponseMessage) {
    type = 'text';
    const nativeFlow = (message.interactiveResponseMessage as any).nativeFlowResponseMessage;
    let selectedId: string | null = null;
    let selectedText: string | null = null;
    if (nativeFlow?.paramsJson) {
      try {
        const parsed = JSON.parse(nativeFlow.paramsJson);
        selectedId = parsed.id || null;
        selectedText = parsed.title || parsed.display_text || null;
      } catch {
        selectedId = nativeFlow.paramsJson;
      }
    }
    text = selectedText || selectedId || message.interactiveResponseMessage.body?.text || (nativeFlow?.paramsJson ? String(nativeFlow.paramsJson) : null);
    quotedMessageId = message.interactiveResponseMessage.contextInfo?.stanzaId || null;
  } else if (message.interactiveMessage) {
    type = 'text';
    text = message.interactiveMessage.body?.text || message.interactiveMessage.header?.title || null;
    quotedMessageId = message.interactiveMessage.contextInfo?.stanzaId || null;
  } else if (message.imageMessage) {
    type = 'image';
    caption = message.imageMessage.caption || null;
    mimetype = message.imageMessage.mimetype || 'image/jpeg';
    mediaUrl = message.imageMessage.url || null;
    quotedMessageId = message.imageMessage.contextInfo?.stanzaId || null;
  } else if (message.videoMessage) {
    type = 'video';
    caption = message.videoMessage.caption || null;
    mimetype = message.videoMessage.mimetype || 'video/mp4';
    mediaUrl = message.videoMessage.url || null;
    quotedMessageId = message.videoMessage.contextInfo?.stanzaId || null;
  } else if (message.audioMessage) {
    type = 'audio';
    mimetype = message.audioMessage.mimetype || 'audio/ogg';
    mediaUrl = message.audioMessage.url || null;
    quotedMessageId = message.audioMessage.contextInfo?.stanzaId || null;
  } else if (message.documentMessage) {
    type = 'document';
    caption = message.documentMessage.caption || null;
    mimetype = message.documentMessage.mimetype || 'application/octet-stream';
    mediaUrl = message.documentMessage.url || null;
    quotedMessageId = message.documentMessage.contextInfo?.stanzaId || null;
  } else if (message.locationMessage || (message as any).liveLocationMessage) {
    type = 'location';
  } else if (message.contactMessage || (message as any).contactsArrayMessage) {
    type = 'contact';
  } else if (message.stickerMessage) {
    type = 'sticker';
  } else if (message.pollCreationMessage || (message as any).pollCreationMessageV2 || (message as any).pollCreationMessageV3) {
    const pollMsg = message.pollCreationMessage || (message as any).pollCreationMessageV2 || (message as any).pollCreationMessageV3;
    type = 'poll';
    text = pollMsg?.name || '[Poll]';
    poll = {
      question: pollMsg?.name || '',
      options: pollMsg?.options?.map((opt: any) => opt.optionName || '') || [],
      selectableCount: pollMsg?.selectableOptionsCount || 1,
    };
  }

  // 5. Ensure we only return real messages (not empty protocol artifacts)
  if (type === 'other' && !text && !caption && !mediaUrl) {
    return null;
  }
  if (type === 'text' && (!text || text.trim() === '')) {
    return null;
  }

  return {
    id: raw.key.id || `msg_${timestamp}`,
    remoteJid,
    senderJid,
    pushName,
    fromMe,
    isGroup,
    type,
    text,
    caption,
    mediaUrl,
    mimetype,
    timestamp,
    quotedMessageId,
    poll,
    raw,
  };
}

export function bindWhatsAppEvents(instanceId: string, socket: WASocket): void {
  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    const instance = db.getInstance(instanceId);
    if (!instance) return;

    for (const rawMsg of messages) {
      const normalized = normalizeBaileysMessage(rawMsg);
      if (!normalized) continue;
      if (normalized.fromMe) continue;

      console.log(`[WhatsApp Inbound] Received valid message from ${normalized.remoteJid} on ${instance.instance_name}: "${normalized.text || normalized.caption || normalized.type}"`);

      if (instance.ignore_groups && normalized.isGroup) {
        continue;
      }

      // 1. Record contact
      db.upsertContact({
        instance_id: instance.id,
        remote_jid: normalized.remoteJid,
        name: normalized.pushName,
      });

      // 2. Opt-out handling
      const bodyText = (normalized.text || normalized.caption || '').trim().toLowerCase();
      if (['stop', 'unsubscribe', 'cancel'].includes(bodyText)) {
        db.setContactOptOut(instance.id, normalized.remoteJid, true);
        db.enqueueOutboundMessage({
          instance_id: instance.id,
          remote_jid: normalized.remoteJid,
          reply_type: 'text',
          text_content: 'You have been unsubscribed from automated messages. Reply START to re-subscribe.',
        });
        continue;
      } else if (['start', 'unstop'].includes(bodyText)) {
        db.setContactOptOut(instance.id, normalized.remoteJid, false);
      }

      // Check if contact has opted out
      const contact = db.getContact(instance.id, normalized.remoteJid);
      if (contact?.opted_out) {
        continue;
      }

      // Download and decrypt inbound media if applicable
      if (['image', 'video', 'audio', 'document', 'sticker'].includes(normalized.type)) {
        const downloaded = await downloadInboundMedia({
          instanceId: instance.id,
          messageId: normalized.id,
          remoteJid: normalized.remoteJid,
          mediaType: normalized.type,
          raw: rawMsg,
          mimeType: normalized.mimetype,
          fileName: rawMsg.message?.documentMessage?.fileName || undefined,
        });
        if (downloaded) {
          normalized.mediaUrl = downloaded.publicUrl;
          if (normalized.type === 'audio' && downloaded.localPath) {
            try {
              const transcription = await transcribeAudioFile(downloaded.localPath);
              if (transcription) {
                console.log(`[Voice AI] Transcribed voice note from ${normalized.remoteJid}: "${transcription.text}" (${transcription.provider} in ${transcription.durationMs}ms)`);
                normalized.text = `[Voice Note]: "${transcription.text}"`;
              }
            } catch (err: any) {
              console.warn(`[Voice AI] Transcription error:`, err?.message);
            }
          }
        }
      }

      // 3. Save message to DB
      const dbMessageId = db.addMessage({
        instance_id: instance.id,
        remote_jid: normalized.remoteJid,
        whatsapp_message_id: normalized.id,
        from_me: false,
        direction: 'inbound',
        message_type: normalized.type,
        text_content: normalized.text,
        caption: normalized.caption,
        media_url: normalized.mediaUrl,
        raw_payload: normalized.raw,
      });

      // 4. Log event
      db.addEventLog(instance.id, 'message.received', {
        message_id: normalized.id,
        remote_jid: normalized.remoteJid,
        text: normalized.text || normalized.caption,
        type: normalized.type,
      });

      // Stream to SSE listeners
      instanceEventStream.emit(instance.id, {
        event: 'message.received',
        instance: { id: instance.id, name: instance.instance_name },
        message: normalized,
        timestamp: new Date().toISOString(),
      });

      // 5. Trigger Webhook if configured (both primary/event-override and n8n if distinct)
      const upsertConfig = instance.events_config?.['messages.upsert'];
      const isUpsertEnabled = upsertConfig ? upsertConfig.enabled : true;

      if (isUpsertEnabled) {
        const primaryUrl = upsertConfig?.webhook_url || instance.webhook_url;
        const webhooksToTrigger: string[] = [];
        if (primaryUrl) webhooksToTrigger.push(primaryUrl);
        if (
          instance.n8n_webhook_url &&
          instance.n8n_webhook_url !== primaryUrl &&
          !(instance.ai_enabled && instance.ai_provider === 'n8n')
        ) {
          webhooksToTrigger.push(instance.n8n_webhook_url);
        }

        for (const targetUrl of webhooksToTrigger) {
          const deliveryId = db.enqueueWebhookDelivery({
            instance_id: instance.id,
            event_type: 'message.received',
            target_url: targetUrl,
            payload: {
              event: 'message.received',
              instance: { id: instance.id, name: instance.instance_name },
              message: normalized,
              timestamp: new Date().toISOString(),
            },
          });
          if (db.claimWebhookDeliveryForSending(deliveryId)) {
            const delivery = db.getWebhookDelivery(deliveryId);
            if (delivery) {
              deliverWebhook(delivery, instance.webhook_secret).catch(() => {});
            }
          }
        }
      }

      // 6. Check Auto-Reply Rules
      const rules = db.listAutoReplyRules(instance.id).filter((r) => r.enabled);
      let autoReplied = false;

      for (const rule of rules) {
        let matched = false;
        const msgText = normalized.text || normalized.caption || '';

        if (rule.match_type === 'exact') {
          matched = msgText.toLowerCase() === rule.match_value.toLowerCase();
        } else if (rule.match_type === 'contains') {
          matched = msgText.toLowerCase().includes(rule.match_value.toLowerCase());
        } else if (rule.match_type === 'starts_with') {
          matched = msgText.toLowerCase().startsWith(rule.match_value.toLowerCase());
        } else if (rule.match_type === 'regex') {
          try {
            matched = new RegExp(rule.match_value, 'i').test(msgText);
          } catch {
            matched = false;
          }
        }

        if (matched) {
          db.enqueueOutboundMessage({
            instance_id: instance.id,
            remote_jid: normalized.remoteJid,
            reply_type: 'text',
            text_content: rule.reply_text,
            quoted_message_id: normalized.id,
          });
          autoReplied = true;
          break;
        }
      }

      if (autoReplied) continue;

      // 7. AI Agent Execution (if enabled and no auto-reply matched)
      if (instance.ai_enabled) {
        processAiReply({
          instance,
          message: normalized,
          dbMessageId,
        }).then((aiText) => {
          if (aiText) {
            db.enqueueOutboundMessage({
              instance_id: instance.id,
              remote_jid: normalized.remoteJid,
              reply_type: 'text',
              text_content: aiText,
              quoted_message_id: normalized.id,
            });
          }
        }).catch((err) => {
          console.error(`[AI Agent Pipeline Error]:`, err?.message);
        });
      }
    }
  });

  // Call rejection handler
  socket.ev.on('call', async (calls) => {
    const instance = db.getInstance(instanceId);
    if (!instance || !instance.reject_calls) return;

    for (const call of calls) {
      if (call.status === 'offer') {
        try {
          await socket.rejectCall(call.id, call.from);
          db.addEventLog(instance.id, 'call.rejected', { call_id: call.id, from: call.from });
          if (instance.webhook_url) {
            const deliveryId = db.enqueueWebhookDelivery({
              instance_id: instance.id,
              event_type: 'call.rejected',
              target_url: instance.webhook_url,
              payload: {
                event: 'call.rejected',
                instance: { id: instance.id, name: instance.instance_name },
                call: { id: call.id, from: call.from },
                timestamp: new Date().toISOString(),
              },
            });
            if (db.claimWebhookDeliveryForSending(deliveryId)) {
              const delivery = db.getWebhookDelivery(deliveryId);
              if (delivery) {
                deliverWebhook(delivery, instance.webhook_secret).catch(() => {});
              }
            }
          }
        } catch {
          // ignore
        }
      }
    }
  });

  // Message status updates (delivered, read receipts)
  socket.ev.on('messages.update', async (updates) => {
    const instance = db.getInstance(instanceId);
    if (!instance) return;
    const cfg = instance.events_config?.['messages.update'];
    if (cfg?.enabled === false) return;

    const targetUrl = cfg?.webhook_url || instance.webhook_url;
    if (!targetUrl) return;

    for (const update of updates) {
      instanceEventStream.emit(instance.id, {
        event: 'messages.update',
        instance: { id: instance.id, name: instance.instance_name },
        data: update,
        timestamp: new Date().toISOString(),
      });

      const deliveryId = db.enqueueWebhookDelivery({
        instance_id: instance.id,
        event_type: 'messages.update',
        target_url: targetUrl,
        payload: {
          event: 'messages.update',
          instance: { id: instance.id, name: instance.instance_name },
          data: update,
          timestamp: new Date().toISOString(),
        },
      });
      if (db.claimWebhookDeliveryForSending(deliveryId)) {
        const delivery = db.getWebhookDelivery(deliveryId);
        if (delivery) {
          deliverWebhook(delivery, instance.webhook_secret).catch(() => {});
        }
      }
    }
  });

  // Presence status updates (online, typing, recording, offline)
  socket.ev.on('presence.update', async (presence) => {
    const instance = db.getInstance(instanceId);
    if (!instance) return;

    instanceEventStream.emit(instance.id, {
      event: 'presence.update',
      instance: { id: instance.id, name: instance.instance_name },
      data: presence,
      timestamp: new Date().toISOString(),
    });

    const cfg = instance.events_config?.['presence.update'];
    if (!cfg?.enabled) return;

    const targetUrl = cfg.webhook_url || instance.webhook_url;
    if (!targetUrl) return;

    const deliveryId = db.enqueueWebhookDelivery({
      instance_id: instance.id,
      event_type: 'presence.update',
      target_url: targetUrl,
      payload: {
        event: 'presence.update',
        instance: { id: instance.id, name: instance.instance_name },
        data: presence,
        timestamp: new Date().toISOString(),
      },
    });
    if (db.claimWebhookDeliveryForSending(deliveryId)) {
      const delivery = db.getWebhookDelivery(deliveryId);
      if (delivery) {
        deliverWebhook(delivery, instance.webhook_secret).catch(() => {});
      }
    }
  });

  // Group metadata updates
  socket.ev.on('groups.update', async (groupUpdates) => {
    const instance = db.getInstance(instanceId);
    if (!instance) return;

    instanceEventStream.emit(instance.id, {
      event: 'groups.update',
      instance: { id: instance.id, name: instance.instance_name },
      data: groupUpdates,
      timestamp: new Date().toISOString(),
    });

    const cfg = instance.events_config?.['groups.update'];
    if (!cfg?.enabled) return;

    const targetUrl = cfg.webhook_url || instance.webhook_url;
    if (!targetUrl) return;

    const deliveryId = db.enqueueWebhookDelivery({
      instance_id: instance.id,
      event_type: 'groups.update',
      target_url: targetUrl,
      payload: {
        event: 'groups.update',
        instance: { id: instance.id, name: instance.instance_name },
        data: groupUpdates,
        timestamp: new Date().toISOString(),
      },
    });
    if (db.claimWebhookDeliveryForSending(deliveryId)) {
      const delivery = db.getWebhookDelivery(deliveryId);
      if (delivery) {
        deliverWebhook(delivery, instance.webhook_secret).catch(() => {});
      }
    }
  });

  // Group participants updates (join, leave, promote, demote)
  socket.ev.on('group-participants.update', async (update) => {
    const instance = db.getInstance(instanceId);
    if (!instance) return;

    instanceEventStream.emit(instance.id, {
      event: 'group-participants.update',
      instance: { id: instance.id, name: instance.instance_name },
      data: update,
      timestamp: new Date().toISOString(),
    });

    db.addEventLog(instance.id, 'group-participants.update', update);

    const cfg = instance.events_config?.['group-participants.update'];
    if (cfg?.enabled === false) return;

    const targetUrl = cfg?.webhook_url || instance.webhook_url;
    if (!targetUrl) return;

    const deliveryId = db.enqueueWebhookDelivery({
      instance_id: instance.id,
      event_type: 'group-participants.update',
      target_url: targetUrl,
      payload: {
        event: 'group-participants.update',
        instance: { id: instance.id, name: instance.instance_name },
        data: update,
        timestamp: new Date().toISOString(),
      },
    });
    if (db.claimWebhookDeliveryForSending(deliveryId)) {
      const delivery = db.getWebhookDelivery(deliveryId);
      if (delivery) {
        deliverWebhook(delivery, instance.webhook_secret).catch(() => {});
      }
    }
  });

  // Reactions updates
  socket.ev.on('messages.reaction', async (reactions) => {
    const instance = db.getInstance(instanceId);
    if (!instance) return;

    for (const rx of reactions) {
      instanceEventStream.emit(instance.id, {
        event: 'messages.reaction',
        instance: { id: instance.id, name: instance.instance_name },
        data: rx,
        timestamp: new Date().toISOString(),
      });

      db.addEventLog(instance.id, 'messages.reaction', rx);

      const cfg = instance.events_config?.['messages.reaction'];
      if (cfg?.enabled === false) continue;

      const targetUrl = cfg?.webhook_url || instance.webhook_url;
      if (!targetUrl) continue;

      const deliveryId = db.enqueueWebhookDelivery({
        instance_id: instance.id,
        event_type: 'messages.reaction',
        target_url: targetUrl,
        payload: {
          event: 'messages.reaction',
          instance: { id: instance.id, name: instance.instance_name },
          data: rx,
          timestamp: new Date().toISOString(),
        },
      });
      if (db.claimWebhookDeliveryForSending(deliveryId)) {
        const delivery = db.getWebhookDelivery(deliveryId);
        if (delivery) {
          deliverWebhook(delivery, instance.webhook_secret).catch(() => {});
        }
      }
    }
  });
}

