export class WhatsAppAiGatewayTrigger {
  description = {
    displayName: 'WhatsApp AI Gateway Trigger',
    name: 'whatsAppAiGatewayTrigger',
    icon: 'file:whatsapp.svg',
    group: ['trigger'],
    version: 1,
    description: 'Starts workflow on incoming WhatsApp messages, media, reactions, or status updates from WhatsApp AI Gateway v2',
    defaults: {
      name: 'WhatsApp AI Gateway Trigger',
    },
    inputs: [],
    outputs: ['main'],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'whatsapp-inbound',
      },
    ],
    properties: [
      {
        displayName: 'Filter Events',
        name: 'eventFilter',
        type: 'multiOptions',
        options: [
          { name: 'Incoming Messages (messages.upsert)', value: 'messages.upsert' },
          { name: 'Message Status / Read Receipts (messages.update)', value: 'messages.update' },
          { name: 'Reactions (messages.reaction)', value: 'messages.reaction' },
          { name: 'Connection Updates (connection.update)', value: 'connection.update' },
          { name: 'Presence Updates (presence.update)', value: 'presence.update' },
        ],
        default: ['messages.upsert'],
        description: 'Only trigger the workflow for selected event types',
      },
      {
        displayName: 'Filter by Instance ID / Name',
        name: 'instanceFilter',
        type: 'string',
        default: '',
        placeholder: 'Leave blank for all instances, or specify instance ID',
        description: 'Only trigger for messages belonging to this instance',
      },
      {
        displayName: 'Ignore Outbound Echoes (From Me)',
        name: 'ignoreOutbound',
        type: 'boolean',
        default: true,
        description: 'Whether to ignore messages sent by yourself from your own phone',
      },
      {
        displayName: 'Ignore Group Messages',
        name: 'ignoreGroups',
        type: 'boolean',
        default: false,
        description: 'Whether to ignore messages received in WhatsApp groups',
      },
      {
        displayName: 'Only Media Messages',
        name: 'onlyMedia',
        type: 'boolean',
        default: false,
        description: 'Whether to trigger only when the message contains an image, video, audio, or document',
      },
    ],
  };

  async webhook(this: any) {
    const req = this.getRequestObject();
    const body = req.body || {};
    const event = body.event || 'messages.upsert';

    const eventFilter = (this.getNodeParameter('eventFilter', []) as string[]) || [];
    const instanceFilter = (this.getNodeParameter('instanceFilter', '') as string || '').trim().toLowerCase();
    const ignoreOutbound = this.getNodeParameter('ignoreOutbound', true) as boolean;
    const ignoreGroups = this.getNodeParameter('ignoreGroups', false) as boolean;
    const onlyMedia = this.getNodeParameter('onlyMedia', false) as boolean;

    // 1. Event Type Filter
    if (eventFilter.length > 0 && !eventFilter.includes(event)) {
      return {};
    }

    const instance = body.instance || {};
    const instanceId = String(instance.id || instance.name || body.instance_id || 'default');

    // 2. Instance Filter
    if (instanceFilter && instanceId.toLowerCase() !== instanceFilter) {
      return {};
    }

    const message = body.message || body.data?.message || {};

    // 3. Outbound Filter
    if (ignoreOutbound && (message.fromMe || message.key?.fromMe)) {
      return {};
    }

    const remoteJid = String(message.remoteJid || message.key?.remoteJid || '');
    const isGroup = remoteJid.endsWith('@g.us');

    // 4. Group Filter
    if (ignoreGroups && isGroup) {
      return {};
    }

    // 5. Media Filter
    const hasMedia = Boolean(message.mediaUrl || message.imageMessage || message.audioMessage || message.videoMessage || message.documentMessage);
    if (onlyMedia && !hasMedia) {
      return {};
    }

    // Extract clean metadata
    const userMessage = (
      message.text ||
      message.caption ||
      message.selectedButtonId ||
      message.selectedRowId ||
      ''
    ).trim();

    const cleanPhone = remoteJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

    const parsedData = {
      event,
      instanceId,
      senderJid: remoteJid,
      senderPhone: cleanPhone ? `+${cleanPhone}` : '',
      senderName: message.pushName || 'WhatsApp User',
      userMessage,
      messageType: message.type || 'text',
      mediaUrl: message.mediaUrl || null,
      messageId: message.id || message.key?.id || null,
      fromMe: Boolean(message.fromMe || message.key?.fromMe),
      isGroup,
      groupJid: isGroup ? remoteJid : null,
      quotedMessage: message.quotedMessage || null,
      timestamp: message.timestamp || Date.now(),
      rawPayload: body,
    };

    return {
      workflowData: [
        [
          {
            json: parsedData,
          },
        ],
      ],
    };
  }
}
