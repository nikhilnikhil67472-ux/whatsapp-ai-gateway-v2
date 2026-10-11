export const instanceOperations = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: {
        resource: ['instance'],
      },
    },
    options: [
      {
        name: 'Get Status & QR Code',
        value: 'status',
        description: 'Fetch real-time connection status and base64 QR code',
        action: 'Get instance status',
      },
      {
        name: 'Request Pairing Code',
        value: 'pairingCode',
        description: 'Generate an 8-digit phone pairing code for camera-less linking',
        action: 'Request pairing code',
      },
      {
        name: 'Set Presence Status',
        value: 'setPresence',
        description: 'Set presence state (available, composing, recording, paused)',
        action: 'Set presence status',
      },
      {
        name: 'Create Instance',
        value: 'create',
        description: 'Create a new WhatsApp instance',
        action: 'Create instance',
      },
      {
        name: 'List Instances',
        value: 'list',
        description: 'List all WhatsApp instances in the workspace',
        action: 'List instances',
      },
      {
        name: 'Start Instance',
        value: 'start',
        description: 'Start connecting WhatsApp instance',
        action: 'Start instance',
      },
      {
        name: 'Restart Instance',
        value: 'restart',
        description: 'Restart connection worker or clear cache',
        action: 'Restart instance',
      },
      {
        name: 'Stop Instance',
        value: 'stop',
        description: 'Disconnect WhatsApp socket',
        action: 'Stop instance',
      },
      {
        name: 'Logout Instance',
        value: 'logout',
        description: 'Unpair and logout WhatsApp session',
        action: 'Logout instance',
      },
      {
        name: 'Delete Instance',
        value: 'delete',
        description: 'Permanently remove an instance',
        action: 'Delete instance',
      },
    ],
    default: 'status',
  },
];

export const instanceFields = [
  // Instance Identifier (required for all operations except create and list)
  {
    displayName: 'Instance ID or Name',
    name: 'instanceId',
    type: 'string',
    default: 'default',
    required: true,
    displayOptions: {
      show: {
        resource: ['instance'],
        operation: ['status', 'pairingCode', 'setPresence', 'start', 'restart', 'stop', 'logout', 'delete'],
      },
    },
    description: 'The target WhatsApp instance ID or friendly name',
  },

  // Pairing Code parameters
  {
    displayName: 'Phone Number (with Country Code)',
    name: 'pairingPhoneNumber',
    type: 'string',
    default: '',
    placeholder: '919876543210',
    required: true,
    displayOptions: {
      show: {
        resource: ['instance'],
        operation: ['pairingCode'],
      },
    },
    description: 'The phone number to link with WhatsApp (e.g. 919876543210)',
  },

  // Set Presence parameters
  {
    displayName: 'Presence Status',
    name: 'presenceState',
    type: 'options',
    options: [
      { name: 'Available (Online)', value: 'available' },
      { name: 'Unavailable (Offline)', value: 'unavailable' },
      { name: 'Composing (Typing...)', value: 'composing' },
      { name: 'Recording (Audio...)', value: 'recording' },
      { name: 'Paused (Stopped Typing)', value: 'paused' },
    ],
    default: 'available',
    required: true,
    displayOptions: {
      show: {
        resource: ['instance'],
        operation: ['setPresence'],
      },
    },
  },
  {
    displayName: 'Target Recipient JID / Phone',
    name: 'presenceRemoteJid',
    type: 'string',
    default: '',
    placeholder: '919876543210 or leave blank for global presence',
    displayOptions: {
      show: {
        resource: ['instance'],
        operation: ['setPresence'],
      },
    },
    description: 'Specific chat to show typing/recording presence in (optional)',
  },

  // Create Instance parameters
  {
    displayName: 'Instance Name',
    name: 'newInstanceName',
    type: 'string',
    default: '',
    placeholder: 'support-line',
    required: true,
    displayOptions: {
      show: {
        resource: ['instance'],
        operation: ['create'],
      },
    },
    description: 'Friendly name for the new instance',
  },
  {
    displayName: 'Proxy URL',
    name: 'newProxyUrl',
    type: 'string',
    default: '',
    placeholder: 'http://user:pass@proxy.example.com:8080 or socks5://...',
    displayOptions: {
      show: {
        resource: ['instance'],
        operation: ['create'],
      },
    },
    description: 'Optional HTTP or SOCKS5 proxy to route this number through',
  },
  {
    displayName: 'Webhook URL',
    name: 'newWebhookUrl',
    type: 'string',
    default: '',
    placeholder: 'https://webhook.yourdomain.com/inbound',
    displayOptions: {
      show: {
        resource: ['instance'],
        operation: ['create'],
      },
    },
  },

  // Restart options
  {
    displayName: 'Purge Stale Session',
    name: 'purgeSession',
    type: 'boolean',
    default: false,
    displayOptions: {
      show: {
        resource: ['instance'],
        operation: ['restart'],
      },
    },
    description: 'Whether to wipe stored credentials and force a fresh QR scan',
  },
];
