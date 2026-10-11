import { signHmacSha256 } from '../security/crypto.js';

export interface N8nWebhookPayload {
  event: string;
  instance: {
    id: string;
    name: string;
  };
  message: {
    id: string;
    remoteJid: string;
    senderJid: string;
    pushName: string | null;
    isGroup: boolean;
    text: string | null;
    caption: string | null;
    mediaUrl: string | null;
    type: string;
    timestamp: number;
  };
  timestamp: string;
}

export async function callN8nWorkflow(params: {
  webhookUrl: string;
  secret?: string | null;
  payload: N8nWebhookPayload;
}): Promise<string | null> {
  const jsonPayload = JSON.stringify(params.payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'WhatsApp-AI-Gateway-v2',
  };

  if (params.secret) {
    headers['x-hub-signature-256'] = `sha256=${signHmacSha256(jsonPayload, params.secret)}`;
    headers['Authorization'] = `Bearer ${params.secret}`;
  }

  const response = await fetch(params.webhookUrl, {
    method: 'POST',
    headers,
    body: jsonPayload,
  });

  if (!response.ok) {
    throw new Error(`n8n webhook error: HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json() as any;
    // Support common n8n return shapes: { text: "..." }, { reply: "..." }, { output: "..." }
    return data.reply || data.text || data.output || (typeof data === 'string' ? data : null);
  } else {
    const text = await response.text();
    return text.trim() || null;
  }
}
