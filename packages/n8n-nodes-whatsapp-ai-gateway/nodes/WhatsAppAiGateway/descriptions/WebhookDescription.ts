export const webhookOperations = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: {
        resource: ['webhook'],
      },
    },
    options: [
      {
        name: 'Get Events Trigger Matrix',
        value: 'getEventsConfig',
        description: 'Get enabled webhook event triggers and target endpoints',
        action: 'Get events config',
      },
      {
        name: 'Update Events Configuration',
        value: 'updateEventsConfig',
        description: 'Enable or disable specific WhatsApp events and assign custom webhook URLs',
        action: 'Update events config',
      },
      {
        name: 'Send Test Webhook Ping',
        value: 'testPing',
        description: 'Send an immediate diagnostic ping to verify webhook connectivity',
        action: 'Send test ping',
      },
      {
        name: 'List Webhook Deliveries',
        value: 'listDeliveries',
        description: 'Fetch delivery logs, HTTP status codes, latency, and failure details',
        action: 'List webhook deliveries',
      },
    ],
    default: 'getEventsConfig',
  },
];

export const webhookFields = [
  {
    displayName: 'Instance ID or Name',
    name: 'instanceId',
    type: 'string',
    default: 'default',
    required: true,
    displayOptions: {
      show: {
        resource: ['webhook'],
      },
    },
    description: 'The target WhatsApp instance ID or friendly name',
  },
  {
    displayName: 'Events JSON / Object',
    name: 'eventsJson',
    type: 'json',
    default: '{\n  "messages.upsert": { "enabled": true, "webhook_url": "https://your-n8n.com/webhook/wa" }\n}',
    required: true,
    displayOptions: {
      show: {
        resource: ['webhook'],
        operation: ['updateEventsConfig'],
      },
    },
    description: 'Granular events configuration map',
  },
  {
    displayName: 'Test Webhook Target URL',
    name: 'testWebhookUrl',
    type: 'string',
    default: '',
    placeholder: 'https://webhook.site/xyz or n8n webhook URL',
    displayOptions: {
      show: {
        resource: ['webhook'],
        operation: ['testPing'],
      },
    },
    description: 'Optional custom URL to ping. If omitted, uses instance default webhook.',
  },
];
