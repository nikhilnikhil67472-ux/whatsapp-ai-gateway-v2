import { db, WhatsAppInstance } from '../db/database.js';
import { decrypt } from '../security/crypto.js';
import { NormalizedMessage } from '../whatsapp/types.js';
import { callOpenAi } from './openai.js';
import { callAnthropic } from './anthropic.js';
import { callN8nWorkflow } from './n8n.js';
import { config } from '../config/index.js';

export async function processAiReply(params: {
  instance: WhatsAppInstance;
  message: NormalizedMessage;
  dbMessageId?: string;
}): Promise<string | null> {
  const { instance, message } = params;
  if (!instance.ai_enabled) return null;

  const userText = message.text || message.caption;
  if (!userText) return null;

  const provider = instance.ai_provider || 'openai';
  const systemPrompt = instance.ai_system_prompt || config.defaultAiSystemPrompt;
  const memoryLimit = Math.max(2, instance.ai_memory_messages || 20);

  // Retrieve previous messages for conversational context
  const recentHistory = db.getRecentMessages(instance.id, message.remoteJid, memoryLimit, params.dbMessageId)
    .reverse()
    .map((m) => ({
      role: (m.from_me ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.text_content || m.caption || '[Attachment]',
    }));

  recentHistory.push({ role: 'user', content: userText });

  const startTime = Date.now();
  const runId = db.createAiRun({
    instance_id: instance.id,
    message_id: params.dbMessageId,
    provider,
    model: instance.ai_model || undefined,
  });

  try {
    let replyText: string | null = null;
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;
    let usedModel: string | undefined;

    if (provider === 'openai') {
      const apiKey = instance.ai_api_key_encrypted
        ? decrypt(instance.ai_api_key_encrypted)
        : undefined;

      const result = await callOpenAi({
        apiKey,
        model: instance.ai_model || undefined,
        systemPrompt,
        messages: recentHistory,
      });

      replyText = result.text;
      promptTokens = result.promptTokens;
      completionTokens = result.completionTokens;
      usedModel = result.model;
    } else if (provider === 'anthropic') {
      const apiKey = instance.ai_api_key_encrypted
        ? decrypt(instance.ai_api_key_encrypted)
        : undefined;

      const result = await callAnthropic({
        apiKey,
        model: instance.ai_model || undefined,
        systemPrompt,
        messages: recentHistory,
      });

      replyText = result.text;
      promptTokens = result.promptTokens;
      completionTokens = result.completionTokens;
      usedModel = result.model;
    } else if (provider === 'n8n' && instance.n8n_webhook_url) {
      const n8nSecret = instance.n8n_secret_encrypted
        ? decrypt(instance.n8n_secret_encrypted)
        : undefined;

      const n8nPayload = {
        event: 'message.received',
        instance: { id: instance.id, name: instance.instance_name },
        message: {
          id: message.id,
          remoteJid: message.remoteJid,
          senderJid: message.senderJid,
          pushName: message.pushName,
          isGroup: message.isGroup,
          text: message.text,
          caption: message.caption,
          mediaUrl: message.mediaUrl,
          type: message.type,
          timestamp: message.timestamp,
        },
        timestamp: new Date().toISOString(),
      };

      const n8nDeliveryId = db.enqueueWebhookDelivery({
        instance_id: instance.id,
        event_type: 'n8n.workflow',
        target_url: instance.n8n_webhook_url,
        payload: n8nPayload,
      });

      const n8nStart = Date.now();
      try {
        replyText = await callN8nWorkflow({
          webhookUrl: instance.n8n_webhook_url,
          secret: n8nSecret,
          payload: n8nPayload,
        });
        db.markWebhookDelivered(n8nDeliveryId, 200, (replyText || 'OK').slice(0, 1000), Date.now() - n8nStart);
      } catch (err: any) {
        db.markWebhookFailed(n8nDeliveryId, err?.message || 'n8n workflow request failed', 500);
        throw err;
      }
      usedModel = 'n8n-workflow';
    }

    const durationMs = Date.now() - startTime;
    db.updateAiRun(runId, {
      status: replyText ? 'success' : 'success_empty',
      response_text: replyText || undefined,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      duration_ms: durationMs,
    });

    return replyText;
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    db.updateAiRun(runId, {
      status: 'error',
      error_message: error?.message || 'AI generation failed',
      duration_ms: durationMs,
    });
    console.error(`[AI Agent Error - ${instance.instance_name}]:`, error?.message);
    return null;
  }
}
