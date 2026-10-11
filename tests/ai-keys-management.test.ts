import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db/database.js';
import { transcribeAudioFile } from '../src/ai/transcription.js';

test('AI Keys Management: Database System Settings & Encryption', async () => {
  // 1. Set Groq key
  db.setSystemSetting('groq_api_key', 'gsk_test_mock_secret_key_12345');
  const retrievedGroq = db.getSystemSetting('groq_api_key');
  assert.equal(retrievedGroq, 'gsk_test_mock_secret_key_12345', 'Groq key should be encrypted and decrypted accurately');

  // 2. Set OpenAI key
  db.setSystemSetting('openai_api_key', 'sk-proj-test_secret_key_67890');
  const retrievedOpenAi = db.getSystemSetting('openai_api_key');
  assert.equal(retrievedOpenAi, 'sk-proj-test_secret_key_67890', 'OpenAI key should be encrypted and decrypted accurately');

  // 3. List system settings (masked)
  const list = db.listSystemSettings();
  assert.ok(list['groq_api_key'], 'groq_api_key should exist in listing');
  assert.ok(list['groq_api_key'].configured, 'groq_api_key should be marked configured');
  assert.ok(list['groq_api_key'].masked.includes('...'), 'groq_api_key should be masked in listing');
  assert.ok(!list['groq_api_key'].masked.includes('mock_secret'), 'Masked key must not reveal secret');

  // 4. Delete system setting
  const deleted = db.deleteSystemSetting('groq_api_key');
  assert.ok(deleted, 'Should delete setting');
  assert.equal(db.getSystemSetting('groq_api_key'), null, 'Deleted setting should return null');

  // Clean up
  db.deleteSystemSetting('openai_api_key');
});
