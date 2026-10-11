export const messageOperations = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: {
        resource: ['message'],
      },
    },
    options: [
      {
        name: 'Send Text Message',
        value: 'sendText',
        description: 'Send a regular WhatsApp text message with markdown formatting',
        action: 'Send a text message',
      },
      {
        name: 'Send Media',
        value: 'sendMedia',
        description: 'Send an image, document/PDF, video, or audio file',
        action: 'Send media',
      },
      {
        name: 'Send Audio / Voice Note',
        value: 'sendAudio',
        description: 'Send audio as a WhatsApp voice note (PTT) with simulated recording presence',
        action: 'Send audio voice note',
      },
      {
        name: 'Send Location',
        value: 'sendLocation',
        description: 'Send GPS location coordinates and place information',
        action: 'Send location',
      },
      {
        name: 'Send Contact',
        value: 'sendContact',
        description: 'Send a contact card (vCard) to the user',
        action: 'Send contact',
      },
      {
        name: 'Send Emoji Reaction',
        value: 'sendReaction',
        description: 'React to a specific WhatsApp message with an emoji',
        action: 'Send emoji reaction',
      },
      {
        name: 'Send Sticker',
        value: 'sendSticker',
        description: 'Send a WebP sticker with custom pack name and author',
        action: 'Send sticker',
      },
      {
        name: 'Send Interactive Poll',
        value: 'sendPoll',
        description: 'Create and send an interactive multi-choice poll',
        action: 'Send interactive poll',
      },
      {
        name: 'Edit Message',
        value: 'edit',
        description: 'Edit a previously sent WhatsApp text message',
        action: 'Edit message',
      },
      {
        name: 'Delete Message',
        value: 'delete',
        description: 'Delete a WhatsApp message for everyone (revoke)',
        action: 'Delete message',
      },
    ],
    default: 'sendText',
  },
];

export const messageFields = [
  // Common parameters for all message operations
  {
    displayName: 'Instance ID or Name',
    name: 'instanceId',
    type: 'string',
    default: 'default',
    required: true,
    displayOptions: {
      show: {
        resource: ['message'],
      },
    },
    description: 'The target WhatsApp instance ID or friendly name',
  },
  {
    displayName: 'Recipient Phone or JID',
    name: 'remoteJid',
    type: 'string',
    default: '',
    placeholder: '919876543210 or 919876543210@s.whatsapp.net',
    required: true,
    displayOptions: {
      show: {
        resource: ['message'],
      },
    },
    description: 'Phone number with country code (e.g. 919876543210) or group JID (12345@g.us)',
  },

  // 1. Send Text
  {
    displayName: 'Message Text',
    name: 'text',
    type: 'string',
    typeOptions: { rows: 4 },
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendText'],
      },
    },
    description: 'The text message content. Supports WhatsApp formatting: *bold*, _italic_, ~strike~, `code`.',
  },
  {
    displayName: 'Quoted Message ID',
    name: 'quotedMessageId',
    type: 'string',
    default: '',
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendText', 'sendMedia', 'sendAudio', 'sendLocation', 'sendContact', 'sendSticker', 'sendPoll'],
      },
    },
    description: 'Optional ID of a previous WhatsApp message to quote / reply to',
  },

  // 2. Send Media
  {
    displayName: 'Media Type',
    name: 'mediaType',
    type: 'options',
    options: [
      { name: 'Image', value: 'image' },
      { name: 'Document / PDF', value: 'document' },
      { name: 'Video', value: 'video' },
      { name: 'Audio', value: 'audio' },
    ],
    default: 'image',
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendMedia'],
      },
    },
  },
  {
    displayName: 'Media URL',
    name: 'mediaUrl',
    type: 'string',
    default: '',
    placeholder: 'https://example.com/invoice.pdf or https://example.com/photo.jpg',
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendMedia'],
      },
    },
    description: 'Public HTTP/HTTPS URL of the file to send',
  },
  {
    displayName: 'Base64 Data',
    name: 'base64',
    type: 'string',
    default: '',
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendMedia', 'sendAudio'],
      },
    },
    description: 'Optional raw Base64 data string instead of a public URL',
  },
  {
    displayName: 'Caption',
    name: 'caption',
    type: 'string',
    default: '',
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendMedia'],
      },
    },
    description: 'Optional caption to include with the media file',
  },
  {
    displayName: 'File Name',
    name: 'fileName',
    type: 'string',
    default: '',
    placeholder: 'Invoice-1024.pdf',
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendMedia'],
      },
    },
    description: 'Optional filename for documents',
  },
  {
    displayName: 'Round PTV Video Note',
    name: 'isPtv',
    type: 'boolean',
    default: false,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendMedia'],
      },
    },
    description: 'Whether to deliver video as a circular instant video note (Push-To-Video)',
  },

  // 3. Send Audio / Voice Note
  {
    displayName: 'Audio URL',
    name: 'audioUrl',
    type: 'string',
    default: '',
    placeholder: 'https://example.com/voicenote.ogg',
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendAudio'],
      },
    },
    description: 'Public URL of the audio file (.ogg, .mp3, .wav)',
  },
  {
    displayName: 'Send as Voice Note (PTT)',
    name: 'isVoiceNote',
    type: 'boolean',
    default: true,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendAudio'],
      },
    },
    description: 'Whether to deliver with the green WhatsApp microphone icon (Push-to-Talk)',
  },


  // 6. Send Location
  {
    displayName: 'Latitude',
    name: 'latitude',
    type: 'number',
    default: 0,
    required: true,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendLocation'],
      },
    },
  },
  {
    displayName: 'Longitude',
    name: 'longitude',
    type: 'number',
    default: 0,
    required: true,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendLocation'],
      },
    },
  },
  {
    displayName: 'Location Name',
    name: 'locationName',
    type: 'string',
    default: '',
    placeholder: 'Central Office',
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendLocation'],
      },
    },
  },
  {
    displayName: 'Address',
    name: 'locationAddress',
    type: 'string',
    default: '',
    placeholder: '123 Tech Park, Suite 400',
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendLocation'],
      },
    },
  },

  // 7. Send Contact
  {
    displayName: 'Contact Full Name',
    name: 'contactName',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendContact'],
      },
    },
  },
  {
    displayName: 'vCard String',
    name: 'contactVcard',
    type: 'string',
    typeOptions: { rows: 4 },
    default: '',
    placeholder: 'BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nTEL;TYPE=CELL:+1234567890\nEND:VCARD',
    required: true,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendContact'],
      },
    },
  },

  // 8. Send Reaction
  {
    displayName: 'Target Message ID',
    name: 'reactionMessageId',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendReaction'],
      },
    },
    description: 'The WhatsApp message ID to react to',
  },
  {
    displayName: 'Emoji',
    name: 'reactionEmoji',
    type: 'string',
    default: '👍',
    required: true,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendReaction'],
      },
    },
    description: 'The emoji reaction (e.g. ❤️, 👍, 😂, 🔥, 👏)',
  },

  // 9. Send Sticker
  {
    displayName: 'Sticker URL',
    name: 'stickerUrl',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendSticker'],
      },
    },
    description: 'Direct HTTP/HTTPS link to image or WebP to convert and send as sticker',
  },
  {
    displayName: 'Sticker Pack Name',
    name: 'packName',
    type: 'string',
    default: 'WhatsApp AI Gateway',
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendSticker'],
      },
    },
    description: 'Custom sticker pack name in WhatsApp sticker tray',
  },
  {
    displayName: 'Sticker Author Name',
    name: 'authorName',
    type: 'string',
    default: 'Antigravity',
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendSticker'],
      },
    },
    description: 'Custom sticker creator/author name in WhatsApp sticker tray',
  },

  // 10. Send Poll
  {
    displayName: 'Poll Question / Name',
    name: 'pollName',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendPoll'],
      },
    },
    description: 'The title/question of the interactive poll',
  },
  {
    displayName: 'Poll Options (Comma-separated)',
    name: 'pollOptions',
    type: 'string',
    default: 'Option A, Option B',
    required: true,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendPoll'],
      },
    },
    description: 'List of answer choices separated by comma (minimum 2)',
  },
  {
    displayName: 'Selectable Choices Count',
    name: 'selectableCount',
    type: 'number',
    default: 1,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['sendPoll'],
      },
    },
    description: 'Maximum options a user can vote for simultaneously (1 for single choice)',
  },

  // 11. Edit Message
  {
    displayName: 'Target Message ID',
    name: 'editMessageId',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['edit'],
      },
    },
    description: 'The ID of the sent message to edit',
  },
  {
    displayName: 'New Text',
    name: 'newText',
    type: 'string',
    typeOptions: {
      rows: 3,
    },
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['edit'],
      },
    },
    description: 'Replacement text content for the message',
  },

  // 12. Delete Message
  {
    displayName: 'Target Message ID',
    name: 'deleteMessageId',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['delete'],
      },
    },
    description: 'The WhatsApp message ID to revoke/delete for everyone',
  },
];

