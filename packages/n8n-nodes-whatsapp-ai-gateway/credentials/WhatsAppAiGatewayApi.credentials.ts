export class WhatsAppAiGatewayApi {
  name = 'whatsAppAiGatewayApi';
  displayName = 'WhatsApp AI Gateway API';
  documentationUrl = 'https://github.com/nikhil/whatsapp-ai-gateway-v2';
  properties = [
    {
      displayName: 'Gateway Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'http://localhost:800',
      placeholder: 'http://127.0.0.1:800 or https://gateway.yourdomain.com',
      required: true,
      description: 'The HTTP URL where your WhatsApp AI Gateway is running (default port 800)',
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Your Gateway API Key (e.g. wag_... generated in the dashboard or .env)',
    },
  ];

  authenticate = {
    type: 'generic',
    properties: {
      headers: {
        'x-api-key': '={{$credentials.apiKey}}',
      },
    },
  };

  test = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/health',
      method: 'GET',
    },
  };
}
