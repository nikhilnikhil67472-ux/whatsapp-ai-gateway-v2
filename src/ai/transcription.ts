import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

export interface TranscriptionResult {
  text: string;
  provider: 'groq' | 'openai';
  durationMs: number;
}

/**
 * Transcribes audio files (OGG Opus, MP3, M4A) via Groq Cloud Whisper Turbo or OpenAI Whisper
 */
export async function transcribeAudioFile(
  filePath: string,
  customApiKey?: string
): Promise<TranscriptionResult | null> {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const groqKey = customApiKey || config.groqApiKey || process.env.GROQ_API_KEY;
  const openaiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;

  if (!groqKey && !openaiKey) {
    return null;
  }

  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const mimeType = fileName.endsWith('.mp3')
    ? 'audio/mpeg'
    : fileName.endsWith('.m4a')
    ? 'audio/mp4'
    : 'audio/ogg';

  const startTime = Date.now();

  // 1. Try Groq Whisper Turbo first (~250ms ultra-low latency, multi-lingual)
  if (groqKey) {
    try {
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: mimeType });
      formData.append('file', blob, fileName);
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('response_format', 'json');

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = (await response.json()) as { text?: string };
        const text = data.text?.trim();
        if (text) {
          const durationMs = Date.now() - startTime;
          return { text, provider: 'groq', durationMs };
        }
      } else {
        const errText = await response.text();
        console.warn(`[Voice AI] Groq Whisper failed (${response.status}):`, errText);
      }
    } catch (err: any) {
      console.warn('[Voice AI] Groq Whisper error:', err?.message);
    }
  }

  // 2. Fallback to OpenAI Whisper
  if (openaiKey) {
    try {
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: mimeType });
      formData.append('file', blob, fileName);
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'json');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = (await response.json()) as { text?: string };
        const text = data.text?.trim();
        if (text) {
          const durationMs = Date.now() - startTime;
          return { text, provider: 'openai', durationMs };
        }
      } else {
        const errText = await response.text();
        console.warn(`[Voice AI] OpenAI Whisper failed (${response.status}):`, errText);
      }
    } catch (err: any) {
      console.warn('[Voice AI] OpenAI Whisper error:', err?.message);
    }
  }

  return null;
}
