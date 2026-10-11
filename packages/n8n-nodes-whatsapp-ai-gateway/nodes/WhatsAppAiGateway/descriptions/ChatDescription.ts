export const chatOperations = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: {
        resource: ['chat'],
      },
    },
    options: [
      {
        name: 'Check Number Exists on WhatsApp',
        value: 'checkNumber',
        description: 'Verify if a phone number is registered and active on WhatsApp',
        action: 'Check number on whatsapp',
      },
      {
        name: 'List Conversations',
        value: 'listConversations',
        description: 'Fetch recent conversations and active chat dialogues',
        action: 'List conversations',
      },
      {
        name: 'List Messages',
        value: 'listMessages',
        description: 'Fetch message history for an instance',
        action: 'List messages',
      },
      {
        name: 'Mark Messages as Read',
        value: 'markAsRead',
        description: 'Send read receipts (blue ticks) for specified message IDs',
        action: 'Mark messages as read',
      },
    ],
    default: 'checkNumber',
  },
];

export const chatFields = [
  {
    displayName: 'Instance ID or Name',
    name: 'instanceId',
    type: 'string',
    default: 'default',
    required: true,
    displayOptions: {
      show: {
        resource: ['chat'],
      },
    },
    description: 'The target WhatsApp instance ID or friendly name',
  },
  {
    displayName: 'Phone Number (with Country Code)',
    name: 'checkPhoneNumber',
    type: 'string',
    default: '',
    placeholder: '919876543210',
    required: true,
    displayOptions: {
      show: {
        resource: ['chat'],
        operation: ['checkNumber'],
      },
    },
    description: 'Phone number to check (e.g. 919876543210)',
  },
  {
    displayName: 'Limit',
    name: 'messageLimit',
    type: 'number',
    default: 50,
    displayOptions: {
      show: {
        resource: ['chat'],
        operation: ['listMessages'],
      },
    },
    description: 'Max number of messages to return',
  },
  {
    displayName: 'Chat / Remote JID',
    name: 'readRemoteJid',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['chat'],
        operation: ['markAsRead'],
      },
    },
    description: 'Remote JID or phone number of the chat',
  },
  {
    displayName: 'Message IDs (Comma-separated)',
    name: 'readMessageIds',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['chat'],
        operation: ['markAsRead'],
      },
    },
    description: 'Comma-separated WhatsApp message IDs to acknowledge with blue ticks',
  },
];
