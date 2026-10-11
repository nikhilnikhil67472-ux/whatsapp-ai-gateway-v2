import { Request, Response } from 'express';
import { db } from '../db/database.js';
import { sendText, sendMedia, sendSticker, sendPoll, checkWhatsAppNumber } from '../whatsapp/sender.js';
import * as groupOps from '../whatsapp/groups.js';

interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

const MCP_TOOLS: McpTool[] = [
  {
    name: 'wag_list_instances',
    description: 'List all WhatsApp instances with their live connection status and phone numbers.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'wag_check_number',
    description: 'Check if a phone number is registered and active on WhatsApp.',
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: { type: 'string', description: 'Instance ID or name' },
        phone: { type: 'string', description: 'Phone number with country code, e.g. +919876543210' },
      },
      required: ['instanceId', 'phone'],
    },
  },
  {
    name: 'wag_send_text',
    description: 'Send a plain text message to a WhatsApp user or group.',
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: { type: 'string', description: 'Instance ID or name' },
        remoteJid: { type: 'string', description: 'Target JID or phone number, e.g. 919876543210@s.whatsapp.net' },
        text: { type: 'string', description: 'Text message body to send' },
        quotedMessageId: { type: 'string', description: 'Optional message ID to quote/reply to' },
      },
      required: ['instanceId', 'remoteJid', 'text'],
    },
  },
  {
    name: 'wag_send_media',
    description: 'Send an image, video, document, or Push-To-Video circular note to WhatsApp.',
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: { type: 'string', description: 'Instance ID or name' },
        remoteJid: { type: 'string', description: 'Target JID or phone number' },
        mediaUrl: { type: 'string', description: 'HTTP/HTTPS URL of the media file' },
        mediaType: { type: 'string', enum: ['image', 'video', 'document'], description: 'Media category' },
        mimeType: { type: 'string', description: 'MIME type, e.g. image/jpeg, video/mp4, application/pdf' },
        caption: { type: 'string', description: 'Optional caption text' },
        isPtv: { type: 'boolean', description: 'Set true for circular instant video note (Push-To-Video)' },
      },
      required: ['instanceId', 'remoteJid', 'mediaUrl', 'mediaType', 'mimeType'],
    },
  },
  {
    name: 'wag_send_sticker',
    description: 'Send an animated or static WebP WhatsApp sticker with custom pack name and author.',
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: { type: 'string', description: 'Instance ID or name' },
        remoteJid: { type: 'string', description: 'Target JID or phone number' },
        stickerUrl: { type: 'string', description: 'Image or WebP URL to convert and send as sticker' },
        packName: { type: 'string', description: 'Custom sticker pack name' },
        authorName: { type: 'string', description: 'Custom sticker author name' },
      },
      required: ['instanceId', 'remoteJid', 'stickerUrl'],
    },
  },
  {
    name: 'wag_send_poll',
    description: 'Create and send an interactive poll with multiple options.',
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: { type: 'string', description: 'Instance ID or name' },
        remoteJid: { type: 'string', description: 'Target JID or phone number' },
        name: { type: 'string', description: 'Question title of the poll' },
        values: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of answer options (minimum 2)',
        },
        selectableCount: { type: 'number', description: 'Max selections allowed per voter (default: 1)' },
      },
      required: ['instanceId', 'remoteJid', 'name', 'values'],
    },
  },
  {
    name: 'wag_list_messages',
    description: 'List recent inbound and outbound messages stored in the gateway database.',
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: { type: 'string', description: 'Instance ID or name' },
        limit: { type: 'number', description: 'Number of messages to retrieve (default: 20)' },
      },
      required: ['instanceId'],
    },
  },
  {
    name: 'wag_manage_group',
    description: 'Manage WhatsApp groups (create, get invite link, update subject/description, add/remove members).',
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: { type: 'string', description: 'Instance ID or name' },
        action: {
          type: 'string',
          enum: ['create', 'metadata', 'update_subject', 'update_description', 'add_participants', 'remove_participants', 'promote_participants', 'demote_participants', 'get_invite_code', 'leave'],
          description: 'Group operation to execute',
        },
        groupJid: { type: 'string', description: 'Group JID (e.g. 120363000000000000@g.us)' },
        subject: { type: 'string', description: 'Group title (required for create and update_subject)' },
        description: { type: 'string', description: 'Group description' },
        participants: { type: 'array', items: { type: 'string' }, description: 'Participant phone numbers or JIDs' },
      },
      required: ['instanceId', 'action'],
    },
  },
];

function resolveInstanceId(ident: string): string {
  const inst = db.getInstanceByIdentifier(ident);
  if (!inst) {
    throw new Error(`Instance '${ident}' not found in gateway database`);
  }
  return inst.id;
}

function normalizeJid(id: string): string {
  if (id.includes('@')) return id;
  const digits = id.replace(/[^0-9]/g, '');
  return `${digits}@s.whatsapp.net`;
}

export async function handleMcpRequest(req: Request, res: Response): Promise<void> {
  const body = req.body;
  const id = body?.id ?? null;
  const method = body?.method;

  if (method === 'initialize') {
    res.json({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'whatsapp-ai-gateway-mcp',
          version: '2.0.0',
        },
      },
    });
    return;
  }

  if (method === 'tools/list') {
    res.json({
      jsonrpc: '2.0',
      id,
      result: {
        tools: MCP_TOOLS,
      },
    });
    return;
  }

  if (method === 'tools/call') {
    const toolName = body?.params?.name;
    const args = body?.params?.arguments || {};

    try {
      let result: any = null;

      if (toolName === 'wag_list_instances') {
        const instances = db.listInstances().map((i) => ({
          id: i.id,
          name: i.instance_name,
          status: i.status,
          phone: i.pairing_phone || i.phone_number,
        }));
        result = { instances };
      } else if (toolName === 'wag_check_number') {
        const instanceId = resolveInstanceId(args.instanceId);
        result = await checkWhatsAppNumber(instanceId, args.phone);
      } else if (toolName === 'wag_send_text') {
        const instanceId = resolveInstanceId(args.instanceId);
        const remoteJid = normalizeJid(args.remoteJid);
        result = await sendText({
          instanceId,
          remoteJid,
          text: args.text,
          quotedMessageId: args.quotedMessageId,
        });
      } else if (toolName === 'wag_send_media') {
        const instanceId = resolveInstanceId(args.instanceId);
        const remoteJid = normalizeJid(args.remoteJid);
        result = await sendMedia({
          instanceId,
          remoteJid,
          mediaUrl: args.mediaUrl,
          mediaType: args.mediaType,
          mimeType: args.mimeType,
          caption: args.caption,
          isPtv: args.isPtv,
        });
      } else if (toolName === 'wag_send_sticker') {
        const instanceId = resolveInstanceId(args.instanceId);
        const remoteJid = normalizeJid(args.remoteJid);
        result = await sendSticker({
          instanceId,
          remoteJid,
          stickerUrl: args.stickerUrl,
          packName: args.packName,
          authorName: args.authorName,
        });
      } else if (toolName === 'wag_send_poll') {
        const instanceId = resolveInstanceId(args.instanceId);
        const remoteJid = normalizeJid(args.remoteJid);
        result = await sendPoll({
          instanceId,
          remoteJid,
          name: args.name,
          values: args.values,
          selectableCount: args.selectableCount,
        });
      } else if (toolName === 'wag_list_messages') {
        const instanceId = resolveInstanceId(args.instanceId);
        const limit = Number(args.limit) || 20;
        result = db.listMessages(instanceId, limit);
      } else if (toolName === 'wag_manage_group') {
        const instanceId = resolveInstanceId(args.instanceId);
        const action = args.action;

        if (action === 'create') {
          result = await groupOps.createGroup({
            instanceId,
            subject: args.subject,
            participants: args.participants || [],
          });
        } else if (action === 'metadata') {
          result = await groupOps.getGroupMetadata(instanceId, args.groupJid);
        } else if (action === 'update_subject') {
          result = await groupOps.updateGroupSubject({
            instanceId,
            groupJid: args.groupJid,
            subject: args.subject,
          });
        } else if (action === 'update_description') {
          result = await groupOps.updateGroupDescription({
            instanceId,
            groupJid: args.groupJid,
            description: args.description,
          });
        } else if (['add_participants', 'remove_participants', 'promote_participants', 'demote_participants'].includes(action)) {
          const act = action.split('_')[0] as any;
          result = await groupOps.updateGroupParticipants({
            instanceId,
            groupJid: args.groupJid,
            participants: args.participants || [],
            action: act,
          });
        } else if (action === 'get_invite_code') {
          result = await groupOps.getGroupInviteCode({
            instanceId,
            groupJid: args.groupJid,
          });
        } else if (action === 'leave') {
          result = await groupOps.leaveGroup({
            instanceId,
            groupJid: args.groupJid,
          });
        } else {
          throw new Error(`Unsupported group action: ${action}`);
        }
      } else {
        res.status(404).json({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Tool not found: ${toolName}` },
        });
        return;
      }

      res.json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        },
      });
    } catch (err: any) {
      res.json({
        jsonrpc: '2.0',
        id,
        result: {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error executing ${toolName}: ${err?.message || String(err)}`,
            },
          ],
        },
      });
    }
    return;
  }

  res.status(400).json({
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Unsupported method: ${method}` },
  });
}
