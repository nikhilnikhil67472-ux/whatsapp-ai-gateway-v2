import { config } from '../config/index.js';
import { AiResponse } from './openai.js';

export function formatAnthropicMessages(
  rawMessages: Array<{ role: 'user' | 'assistant'; content: string }>
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (rawMessages.length === 0) return [];

  const coalesced: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const m of rawMessages) {
    const content = (m.content || '').trim();
    if (!content) continue;

    if (coalesced.length > 0 && coalesced[coalesced.length - 1].role === m.role) {
      coalesced[coalesced.length - 1].content += `\n${content}`;
    } else {
      coalesced.push({ role: m.role, content });
    }
  }

  // Anthropic requires the first message to be from 'user'
  while (coalesced.length > 0 && coalesced[0].role !== 'user') {
    coalesced.shift();
  }

  return coalesced;
}

export async function callAnthropic(params: {
  apiKey?: string;
  model?: string;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<AiResponse> {
  const key = params.apiKey || config.anthropicApiKey;
  if (!key) {
    throw new Error('Anthropic API key is not configured');
  }

  const model = params.model || config.anthropicModel;
  const formattedMessages = formatAnthropicMessages(params.messages);

  if (formattedMessages.length === 0) {
    throw new Error('No valid user messages found for Anthropic request');
  }

  const requestBody = {
    model,
    system: params.systemPrompt,
    messages: formattedMessages,
    max_tokens: 1000,
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const data = (await response.json()) as any;
  if (!response.ok) {
    throw new Error(data.error?.message || `Anthropic request failed: HTTP ${response.status}`);
  }

  const text = (data.content || [])
    .filter((c: any) => c.type === 'text')
    .map((c: any) => c.text)
    .join('\n')
    .trim();

  return {
    text,
    promptTokens: data.usage?.input_tokens,
    completionTokens: data.usage?.output_tokens,
    model,
  };
}
