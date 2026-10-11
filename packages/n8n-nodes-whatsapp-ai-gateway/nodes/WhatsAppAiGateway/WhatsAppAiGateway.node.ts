import { gatewayApiRequest } from './GenericFunctions.js';
import { instanceOperations, instanceFields } from './descriptions/InstanceDescription.js';
import { messageOperations, messageFields } from './descriptions/MessageDescription.js';
import { chatOperations, chatFields } from './descriptions/ChatDescription.js';
import { groupOperations, groupFields } from './descriptions/GroupDescription.js';
import { webhookOperations, webhookFields } from './descriptions/WebhookDescription.js';
import { mediaAiOperations, mediaAiFields } from './descriptions/MediaAiDescription.js';

export class WhatsAppAiGateway {
  description = {
    displayName: 'WhatsApp AI Gateway',
    name: 'whatsAppAiGateway',
    icon: 'file:whatsapp.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
    description: 'Autonomous WhatsApp Web AI Gateway - Send messages, media, voice notes, polls, stickers, and manage instances',
    defaults: {
      name: 'WhatsApp AI Gateway',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'whatsAppAiGatewayApi',
        required: true,
      },
    ],
    properties: [
      // 1. Primary Resource Selector
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Message',
            value: 'message',
            description: 'Send text, media, voice notes, polls, stickers, and emoji reactions',
          },
          {
            name: 'Group',
            value: 'group',
            description: 'Create and manage WhatsApp groups, participants, settings, and invite links',
          },
          {
            name: 'Instance',
            value: 'instance',
            description: 'Manage instances, QR codes, 8-digit phone pairing, and presence',
          },
          {
            name: 'Chat',
            value: 'chat',
            description: 'Check WhatsApp numbers, fetch message history, and mark read receipts',
          },
          {
            name: 'Webhook & Events',
            value: 'webhook',
            description: 'Configure granular triggers, test ping, and view delivery logs',
          },
          {
            name: 'Voice & Media AI',
            value: 'mediaAi',
            description: 'Transcribe voice notes via Whisper Turbo or inspect images with Vision AI',
          },
        ],
        default: 'message',
      },

      // 2. Attach Operations & Fields
      ...instanceOperations,
      ...instanceFields,

      ...messageOperations,
      ...messageFields,

      ...groupOperations,
      ...groupFields,

      ...chatOperations,
      ...chatFields,

      ...webhookOperations,
      ...webhookFields,

      ...mediaAiOperations,
      ...mediaAiFields,
    ],
  };

  async execute(this: any) {
    const items = this.getInputData();
    const returnData = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const resource = this.getNodeParameter('resource', i) as string;
        const operation = this.getNodeParameter('operation', i) as string;

        let responseData: any;

        // ==========================
        // RESOURCE: INSTANCE
        // ==========================
        if (resource === 'instance') {
          if (operation === 'status') {
            const instanceId = this.getNodeParameter('instanceId', i) as string;
            responseData = await gatewayApiRequest.call(this, {
              method: 'GET',
              endpoint: `/api/v1/instances/${encodeURIComponent(instanceId)}/status`,
            });
          } else if (operation === 'pairingCode') {
            const instanceId = this.getNodeParameter('instanceId', i) as string;
            const phone = this.getNodeParameter('pairingPhoneNumber', i) as string;
            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: `/api/v1/instances/${encodeURIComponent(instanceId)}/pairing-code`,
              body: { phone_number: phone },
            });
          } else if (operation === 'setPresence') {
            const instanceId = this.getNodeParameter('instanceId', i) as string;
            const presence = this.getNodeParameter('presenceState', i) as string;
            const remoteJid = this.getNodeParameter('presenceRemoteJid', i, '') as string;
            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: '/api/v1/whatsapp/presence',
              body: {
                instance_id: instanceId,
                remote_jid: remoteJid || undefined,
                presence,
              },
            });
          } else if (operation === 'create') {
            const instanceName = this.getNodeParameter('newInstanceName', i) as string;
            const proxyUrl = this.getNodeParameter('newProxyUrl', i, '') as string;
            const webhookUrl = this.getNodeParameter('newWebhookUrl', i, '') as string;
            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: '/api/v1/instances',
              body: {
                instance_name: instanceName,
                proxy_url: proxyUrl || undefined,
                webhook_url: webhookUrl || undefined,
              },
            });
          } else if (operation === 'list') {
            responseData = await gatewayApiRequest.call(this, {
              method: 'GET',
              endpoint: '/api/v1/instances',
            });
          } else if (operation === 'start') {
            const instanceId = this.getNodeParameter('instanceId', i) as string;
            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: `/api/v1/instances/${encodeURIComponent(instanceId)}/start`,
            });
          } else if (operation === 'restart') {
            const instanceId = this.getNodeParameter('instanceId', i) as string;
            const purgeSession = this.getNodeParameter('purgeSession', i, false) as boolean;
            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: `/api/v1/instances/${encodeURIComponent(instanceId)}/restart`,
              body: { purge_session: purgeSession },
            });
          } else if (operation === 'stop') {
            const instanceId = this.getNodeParameter('instanceId', i) as string;
            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: `/api/v1/instances/${encodeURIComponent(instanceId)}/stop`,
            });
          } else if (operation === 'logout') {
            const instanceId = this.getNodeParameter('instanceId', i) as string;
            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: `/api/v1/instances/${encodeURIComponent(instanceId)}/logout`,
            });
          } else if (operation === 'delete') {
            const instanceId = this.getNodeParameter('instanceId', i) as string;
            responseData = await gatewayApiRequest.call(this, {
              method: 'DELETE',
              endpoint: `/api/v1/instances/${encodeURIComponent(instanceId)}`,
            });
          }
        }

        // ==========================
        // RESOURCE: MESSAGE
        // ==========================
        else if (resource === 'message') {
          const instanceId = this.getNodeParameter('instanceId', i) as string;
          const remoteJid = this.getNodeParameter('remoteJid', i) as string;

          if (operation === 'sendText') {
            const text = this.getNodeParameter('text', i) as string;
            const quotedMessageId = this.getNodeParameter('quotedMessageId', i, '') as string;
            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: '/api/v1/whatsapp/send',
              body: {
                instance_id: instanceId,
                remote_jid: remoteJid,
                type: 'text',
                text,
                quoted_message_id: quotedMessageId || undefined,
              },
            });
          } else if (operation === 'sendMedia') {
            const mediaType = this.getNodeParameter('mediaType', i) as string;
            const mediaUrl = this.getNodeParameter('mediaUrl', i, '') as string;
            const base64 = this.getNodeParameter('base64', i, '') as string;
            const caption = this.getNodeParameter('caption', i, '') as string;
            const fileName = this.getNodeParameter('fileName', i, '') as string;
            const isPtv = this.getNodeParameter('isPtv', i, false) as boolean;
            const quotedMessageId = this.getNodeParameter('quotedMessageId', i, '') as string;

            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: '/api/v1/whatsapp/send',
              body: {
                instance_id: instanceId,
                remote_jid: remoteJid,
                type: mediaType === 'audio' ? 'audio' : 'media',
                media_type: mediaType !== 'audio' ? mediaType : undefined,
                media_url: mediaUrl || undefined,
                base64: base64 || undefined,
                caption: caption || undefined,
                file_name: fileName || undefined,
                is_ptv: isPtv || undefined,
                quoted_message_id: quotedMessageId || undefined,
              },
            });
          } else if (operation === 'sendAudio') {
            const audioUrl = this.getNodeParameter('audioUrl', i, '') as string;
            const base64 = this.getNodeParameter('base64', i, '') as string;
            const isVoiceNote = this.getNodeParameter('isVoiceNote', i, true) as boolean;
            const quotedMessageId = this.getNodeParameter('quotedMessageId', i, '') as string;

            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: '/api/v1/whatsapp/send',
              body: {
                instance_id: instanceId,
                remote_jid: remoteJid,
                type: 'audio',
                media_url: audioUrl || undefined,
                base64: base64 || undefined,
                is_voice_note: isVoiceNote,
                quoted_message_id: quotedMessageId || undefined,
              },
            });
          } else if (operation === 'sendLocation') {
            const latitude = this.getNodeParameter('latitude', i) as number;
            const longitude = this.getNodeParameter('longitude', i) as number;
            const locationName = this.getNodeParameter('locationName', i, '') as string;
            const locationAddress = this.getNodeParameter('locationAddress', i, '') as string;
            const quotedMessageId = this.getNodeParameter('quotedMessageId', i, '') as string;

            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: '/api/v1/whatsapp/send',
              body: {
                instance_id: instanceId,
                remote_jid: remoteJid,
                type: 'location',
                latitude,
                longitude,
                contact_name: locationName || undefined,
                vcard: locationAddress || undefined,
                quoted_message_id: quotedMessageId || undefined,
              },
            });
          } else if (operation === 'sendContact') {
            const contactName = this.getNodeParameter('contactName', i) as string;
            const contactVcard = this.getNodeParameter('contactVcard', i) as string;
            const quotedMessageId = this.getNodeParameter('quotedMessageId', i, '') as string;

            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: '/api/v1/whatsapp/send',
              body: {
                instance_id: instanceId,
                remote_jid: remoteJid,
                type: 'contact',
                contact_name: contactName,
                vcard: contactVcard,
                quoted_message_id: quotedMessageId || undefined,
              },
            });
          } else if (operation === 'sendReaction') {
            const messageId = this.getNodeParameter('reactionMessageId', i) as string;
            const emoji = this.getNodeParameter('reactionEmoji', i) as string;

            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: '/api/v1/whatsapp/reaction',
              body: {
                instance_id: instanceId,
                remote_jid: remoteJid,
                message_id: messageId,
                emoji,
              },
            });
          } else if (operation === 'sendSticker') {
            const stickerUrl = this.getNodeParameter('stickerUrl', i) as string;
            const packName = this.getNodeParameter('packName', i, 'WhatsApp AI Gateway') as string;
            const authorName = this.getNodeParameter('authorName', i, 'Antigravity') as string;

            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: '/api/v1/whatsapp/send-sticker',
              body: {
                instance_id: instanceId,
                remote_jid: remoteJid,
                sticker_url: stickerUrl.startsWith('http') ? stickerUrl : undefined,
                base64: !stickerUrl.startsWith('http') ? stickerUrl : undefined,
                pack_name: packName,
                author_name: authorName,
              },
            });
          } else if (operation === 'sendPoll') {
            const pollName = this.getNodeParameter('pollName', i) as string;
            const optionsStr = this.getNodeParameter('pollOptions', i) as string;
            const selectableCount = this.getNodeParameter('selectableCount', i, 1) as number;
            const values = optionsStr.split(',').map((s: string) => s.trim()).filter(Boolean);

            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: '/api/v1/whatsapp/send-poll',
              body: {
                instance_id: instanceId,
                remote_jid: remoteJid,
                name: pollName,
                values,
                selectable_count: selectableCount,
              },
            });
          } else if (operation === 'edit') {
            const messageId = this.getNodeParameter('editMessageId', i) as string;
            const newText = this.getNodeParameter('newText', i) as string;

            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: '/api/v1/whatsapp/messages/edit',
              body: {
                instance_id: instanceId,
                remote_jid: remoteJid,
                message_id: messageId,
                new_text: newText,
              },
            });
          } else if (operation === 'delete') {
            const messageId = this.getNodeParameter('deleteMessageId', i) as string;

            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: '/api/v1/whatsapp/messages/delete',
              body: {
                instance_id: instanceId,
                remote_jid: remoteJid,
                message_id: messageId,
              },
            });
          }
        }

        // ==========================
        // RESOURCE: GROUP
        // ==========================
        else if (resource === 'group') {
          const instanceId = this.getNodeParameter('instanceId', i) as string;

          if (operation === 'create') {
            const subject = this.getNodeParameter('subject', i) as string;
            const partsStr = this.getNodeParameter('participants', i) as string;
            const participants = partsStr.split(',').map((s: string) => s.trim()).filter(Boolean);

            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: '/api/v1/whatsapp/groups',
              body: {
                instance_id: instanceId,
                subject,
                participants,
              },
            });
          } else if (operation === 'getMetadata') {
            const groupJid = this.getNodeParameter('groupJid', i) as string;
            responseData = await gatewayApiRequest.call(this, {
              method: 'GET',
              endpoint: `/api/v1/whatsapp/groups/${encodeURIComponent(groupJid)}`,
              qs: { instance_id: instanceId },
            });
          } else if (operation === 'updateSubject') {
            const groupJid = this.getNodeParameter('groupJid', i) as string;
            const subject = this.getNodeParameter('subject', i) as string;
            responseData = await gatewayApiRequest.call(this, {
              method: 'PATCH',
              endpoint: `/api/v1/whatsapp/groups/${encodeURIComponent(groupJid)}/subject`,
              body: {
                instance_id: instanceId,
                subject,
              },
            });
          } else if (operation === 'updateDescription') {
            const groupJid = this.getNodeParameter('groupJid', i) as string;
            const description = this.getNodeParameter('description', i) as string;
            responseData = await gatewayApiRequest.call(this, {
              method: 'PATCH',
              endpoint: `/api/v1/whatsapp/groups/${encodeURIComponent(groupJid)}/description`,
              body: {
                instance_id: instanceId,
                description,
              },
            });
          } else if (operation === 'manageParticipants') {
            const groupJid = this.getNodeParameter('groupJid', i) as string;
            const action = this.getNodeParameter('action', i) as string;
            const partsStr = this.getNodeParameter('participants', i) as string;
            const participants = partsStr.split(',').map((s: string) => s.trim()).filter(Boolean);

            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: `/api/v1/whatsapp/groups/${encodeURIComponent(groupJid)}/participants`,
              body: {
                instance_id: instanceId,
                action,
                participants,
              },
            });
          } else if (operation === 'getInviteCode') {
            const groupJid = this.getNodeParameter('groupJid', i) as string;
            responseData = await gatewayApiRequest.call(this, {
              method: 'GET',
              endpoint: `/api/v1/whatsapp/groups/${encodeURIComponent(groupJid)}/invite-code`,
              qs: { instance_id: instanceId },
            });
          } else if (operation === 'revokeInvite') {
            const groupJid = this.getNodeParameter('groupJid', i) as string;
            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: `/api/v1/whatsapp/groups/${encodeURIComponent(groupJid)}/revoke-invite`,
              body: { instance_id: instanceId },
            });
          } else if (operation === 'join') {
            const inviteCode = this.getNodeParameter('inviteCode', i) as string;
            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: '/api/v1/whatsapp/groups/join',
              body: {
                instance_id: instanceId,
                invite_code: inviteCode,
              },
            });
          } else if (operation === 'updateSettings') {
            const groupJid = this.getNodeParameter('groupJid', i) as string;
            const setting = this.getNodeParameter('setting', i) as string;
            responseData = await gatewayApiRequest.call(this, {
              method: 'PATCH',
              endpoint: `/api/v1/whatsapp/groups/${encodeURIComponent(groupJid)}/settings`,
              body: {
                instance_id: instanceId,
                setting,
              },
            });
          } else if (operation === 'leave') {
            const groupJid = this.getNodeParameter('groupJid', i) as string;
            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: `/api/v1/whatsapp/groups/${encodeURIComponent(groupJid)}/leave`,
              body: { instance_id: instanceId },
            });
          }
        }

        // ==========================
        // RESOURCE: CHAT
        // ==========================
        else if (resource === 'chat') {
          const instanceId = this.getNodeParameter('instanceId', i) as string;

          if (operation === 'checkNumber') {
            const phone = this.getNodeParameter('checkPhoneNumber', i) as string;
            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: '/api/v1/whatsapp/check-number',
              body: {
                instance_id: instanceId,
                phone,
              },
            });
          } else if (operation === 'listConversations') {
            responseData = await gatewayApiRequest.call(this, {
              method: 'GET',
              endpoint: `/api/v1/instances/${encodeURIComponent(instanceId)}/conversations`,
            });
          } else if (operation === 'listMessages') {
            const limit = this.getNodeParameter('messageLimit', i, 50) as number;
            responseData = await gatewayApiRequest.call(this, {
              method: 'GET',
              endpoint: `/api/v1/instances/${encodeURIComponent(instanceId)}/messages`,
              qs: { limit },
            });
          } else if (operation === 'markAsRead') {
            const readRemoteJid = this.getNodeParameter('readRemoteJid', i) as string;
            const idsStr = this.getNodeParameter('readMessageIds', i) as string;
            const messageIds = idsStr.split(',').map((s: string) => s.trim()).filter(Boolean);

            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: '/api/v1/whatsapp/messages/read',
              body: {
                instance_id: instanceId,
                remote_jid: readRemoteJid,
                message_ids: messageIds,
              },
            });
          }
        }

        // ==========================
        // RESOURCE: WEBHOOK
        // ==========================
        else if (resource === 'webhook') {
          const instanceId = this.getNodeParameter('instanceId', i) as string;

          if (operation === 'getEventsConfig') {
            responseData = await gatewayApiRequest.call(this, {
              method: 'GET',
              endpoint: `/api/v1/instances/${encodeURIComponent(instanceId)}/events-config`,
            });
          } else if (operation === 'updateEventsConfig') {
            let events = this.getNodeParameter('eventsJson', i) as any;
            if (typeof events === 'string') {
              try {
                events = JSON.parse(events);
              } catch {
                // Keep raw
              }
            }
            responseData = await gatewayApiRequest.call(this, {
              method: 'PATCH',
              endpoint: `/api/v1/instances/${encodeURIComponent(instanceId)}/events-config`,
              body: { events },
            });
          } else if (operation === 'testPing') {
            const testUrl = this.getNodeParameter('testWebhookUrl', i, '') as string;
            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: `/api/v1/instances/${encodeURIComponent(instanceId)}/webhooks/test-ping`,
              body: { webhook_url: testUrl || undefined },
            });
          } else if (operation === 'listDeliveries') {
            responseData = await gatewayApiRequest.call(this, {
              method: 'GET',
              endpoint: `/api/v1/instances/${encodeURIComponent(instanceId)}/webhooks/deliveries`,
            });
          }
        }

        // ==========================
        // RESOURCE: MEDIA & VOICE AI
        // ==========================
        else if (resource === 'mediaAi') {
          if (operation === 'transcribeAudio') {
            const audioSource = this.getNodeParameter('audioSource', i) as string;
            const body = audioSource.startsWith('http')
              ? { audio_url: audioSource }
              : { base64: audioSource };
            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: '/api/v1/media/transcribe',
              body,
            });
          } else if (operation === 'analyzeImage') {
            const imageSource = this.getNodeParameter('imageSource', i) as string;
            const prompt = this.getNodeParameter('imagePrompt', i) as string;
            const body = {
              prompt,
              ...(imageSource.startsWith('http')
                ? { image_url: imageSource }
                : { base64: imageSource }),
            };
            responseData = await gatewayApiRequest.call(this, {
              method: 'POST',
              endpoint: '/api/v1/media/analyze',
              body,
            });
          }
        }

        returnData.push({ json: responseData });
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: error.message } });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}
