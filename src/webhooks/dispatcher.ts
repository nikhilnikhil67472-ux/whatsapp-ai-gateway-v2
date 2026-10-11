import { db, WebhookDelivery } from '../db/database.js';
import { signHmacSha256 } from '../security/crypto.js';

export async function deliverWebhook(delivery: WebhookDelivery, webhookSecret?: string | null): Promise<boolean> {
  const startTime = Date.now();
  const payloadString = typeof delivery.payload === 'string'
    ? delivery.payload
    : JSON.stringify(delivery.payload);

  let targetUrl = delivery.target_url?.trim() || '';
  if (targetUrl && !/^https?:\/\//i.test(targetUrl)) {
    if (/^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/i.test(targetUrl)) {
      targetUrl = `http://${targetUrl}`;
    } else {
      targetUrl = `https://${targetUrl}`;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'WhatsApp-AI-Gateway-v2',
    'x-gateway-event': delivery.event_type,
    'x-delivery-id': delivery.id,
  };

  if (webhookSecret) {
    headers['x-hub-signature-256'] = `sha256=${signHmacSha256(payloadString, webhookSecret)}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal,
    });

    const responseBody = (await response.text()).slice(0, 1000);
    const durationMs = Date.now() - startTime;

    if (response.ok) {
      db.markWebhookDelivered(delivery.id, response.status, responseBody, durationMs);
      return true;
    } else {
      db.markWebhookFailed(
        delivery.id,
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        durationMs,
        responseBody
      );
      return false;
    }
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const isTimeout = error?.name === 'AbortError';
    db.markWebhookFailed(
      delivery.id,
      isTimeout ? 'Webhook delivery timed out (15s)' : error?.message || 'Unknown network error',
      undefined,
      durationMs
    );
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
