import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAnthropicMessages } from '../src/ai/anthropic.js';

test('AI Anthropic: Coalesces consecutive messages of the same role and enforces user start', () => {
  const rawInput = [
    { role: 'assistant' as const, content: 'Initial bot greeting' },
    { role: 'user' as const, content: 'First user message' },
    { role: 'user' as const, content: 'Second user message' },
    { role: 'assistant' as const, content: 'Bot reply' },
    { role: 'user' as const, content: 'Third user message' },
  ];

  const formatted = formatAnthropicMessages(rawInput);

  // 1. Initial assistant message must be stripped so conversation starts with user
  assert.equal(formatted[0].role, 'user');

  // 2. The two consecutive user messages should be coalesced into one with newline
  assert.equal(formatted[0].content, 'First user message\nSecond user message');

  // 3. Alternate to assistant
  assert.equal(formatted[1].role, 'assistant');
  assert.equal(formatted[1].content, 'Bot reply');

  // 4. Alternate back to user
  assert.equal(formatted[2].role, 'user');
  assert.equal(formatted[2].content, 'Third user message');

  assert.equal(formatted.length, 3);
});

test('AI Anthropic: Handles empty messages safely', () => {
  const formatted = formatAnthropicMessages([]);
  assert.equal(formatted.length, 0);

  const onlyAssistant = [{ role: 'assistant' as const, content: 'Hi' }];
  assert.equal(formatAnthropicMessages(onlyAssistant).length, 0);
});
