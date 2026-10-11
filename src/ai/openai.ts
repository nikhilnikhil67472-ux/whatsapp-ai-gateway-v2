import { config } from '../config/index.js';
import { db } from '../db/database.js';

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiResponse {
  text: string;
  promptTokens?: number;
  completionTokens?: number;
  model: string;
}

export async function callOpenAi(params: {
  apiKey?: string;
  model?: string;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<AiResponse> {
  const key = params.apiKey || db.getSystemSetting('openai_api_key') || config.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI API key is not configured. Add it in Dashboard settings or .env');
  }

  const model = params.model || config.openaiModel;
  const requestBody = {
    model,
    messages: [
      { role: 'system', content: params.systemPrompt },
      ...params.messages,
    ],
    max_tokens: 1000,
    temperature: 0.7,
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const data = (await response.json()) as any;
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI request failed: HTTP ${response.status}`);
  }

  const text = data.choices?.[0]?.message?.content?.trim() || '';
  return {
    text,
    promptTokens: data.usage?.prompt_tokens,
    completionTokens: data.usage?.completion_tokens,
    model,
  };
}
