import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBaileysMessage } from '../src/whatsapp/events.js';

test('WhatsApp Events: Normalize conversation text message', () => {
  const rawMsg = {
    key: {
      remoteJid: '919876543210@s.whatsapp.net',
      id: 'MSG_12345',
      fromMe: false,
    },
    message: {
      conversation: 'Hello WhatsApp Gateway!',
    },
    pushName: 'Alice',
    messageTimestamp: 1700000000,
  } as any;

  const normalized = normalizeBaileysMessage(rawMsg);
  assert.ok(normalized);
  assert.equal(normalized.id, 'MSG_12345');
  assert.equal(normalized.remoteJid, '919876543210@s.whatsapp.net');
  assert.equal(normalized.type, 'text');
  assert.equal(normalized.text, 'Hello WhatsApp Gateway!');
  assert.equal(normalized.fromMe, false);
  assert.equal(normalized.isGroup, false);
  assert.equal(normalized.pushName, 'Alice');
});

test('WhatsApp Events: Normalize extended text with quoted message', () => {
  const rawMsg = {
    key: {
      remoteJid: '123456789@g.us',
      participant: '919876543210@s.whatsapp.net',
      id: 'MSG_EXT_99',
      fromMe: false,
    },
    message: {
      extendedTextMessage: {
        text: 'Reply to question',
        contextInfo: {
          stanzaId: 'PARENT_MSG_01',
        },
      },
    },
    pushName: 'Bob',
    messageTimestamp: 1700000050,
  } as any;

  const normalized = normalizeBaileysMessage(rawMsg);
  assert.ok(normalized);
  assert.equal(normalized.id, 'MSG_EXT_99');
  assert.equal(normalized.isGroup, true);
  assert.equal(normalized.type, 'text');
  assert.equal(normalized.text, 'Reply to question');
  assert.equal(normalized.quotedMessageId, 'PARENT_MSG_01');
});

test('WhatsApp Events: Ignore status broadcast messages', () => {
  const rawMsg = {
    key: {
      remoteJid: 'status@broadcast',
      id: 'STATUS_MSG',
      fromMe: false,
    },
    message: {
      conversation: 'My status update',
    },
  } as any;

  const normalized = normalizeBaileysMessage(rawMsg);
  assert.equal(normalized, null);
});

test('WhatsApp Events: Filter out phone system notification stubs and newsletters', () => {
  // 1. Phone system notification stub (e.g. call missed, encryption notice, group change)
  const stubMsg = {
    key: {
      remoteJid: '919876543210@s.whatsapp.net',
      id: 'NOTIF_STUB_1',
      fromMe: false,
    },
    messageStubType: 28, // e.g. GROUP_PARTICIPANT_ADD
    message: null,
  } as any;
  assert.equal(normalizeBaileysMessage(stubMsg), null);

  // 1b. Protobuf enum 0 stub type (falsy number)
  const stubZero = {
    key: {
      remoteJid: '919876543210@s.whatsapp.net',
      id: 'NOTIF_STUB_ZERO',
      fromMe: false,
    },
    messageStubType: 0,
    message: { conversation: 'System call event' },
  } as any;
  assert.equal(normalizeBaileysMessage(stubZero), null);

  // 1c. Stub parameters without stubType
  const stubParamMsg = {
    key: {
      remoteJid: '919876543210@s.whatsapp.net',
      id: 'NOTIF_STUB_PARAMS',
      fromMe: false,
    },
    messageStubParameters: ['user_added'],
    message: null,
  } as any;
  assert.equal(normalizeBaileysMessage(stubParamMsg), null);

  // 2. WhatsApp Channels / Newsletters
  const newsletterMsg = {
    key: {
      remoteJid: '120363000000000000@newsletter',
      id: 'NEWS_MSG_1',
      fromMe: false,
    },
    message: { conversation: 'Breaking news' },
  } as any;
  assert.equal(normalizeBaileysMessage(newsletterMsg), null);

  // 3. Broadcast list
  const broadcastMsg = {
    key: {
      remoteJid: '123456789@broadcast',
      id: 'BCAST_1',
      fromMe: false,
    },
    message: { conversation: 'Broadcast text' },
  } as any;
  assert.equal(normalizeBaileysMessage(broadcastMsg), null);

  // 4. WhatsApp Multi-Device LID messages are normalized and accepted
  const lidMsg = {
    key: {
      remoteJid: '12345678901234:2@lid',
      id: 'LID_MSG_1',
      fromMe: false,
    },
    message: { conversation: 'Hello from another phone' },
  } as any;
  const normLid = normalizeBaileysMessage(lidMsg);
  assert.ok(normLid);
  assert.equal(normLid.remoteJid, '12345678901234@lid');
  assert.equal(normLid.text, 'Hello from another phone');
});

test('WhatsApp Events: Filter out protocol messages, reactions, and history sync', () => {
  // Protocol message (e.g. revoke, ephemeral settings)
  const protocolMsg = {
    key: {
      remoteJid: '919876543210@s.whatsapp.net',
      id: 'PROTO_1',
      fromMe: false,
    },
    message: {
      protocolMessage: { type: 0, key: { id: 'TARGET_1' } },
    },
  } as any;
  assert.equal(normalizeBaileysMessage(protocolMsg), null);

  // Reaction message (emoji)
  const reactionMsg = {
    key: {
      remoteJid: '919876543210@s.whatsapp.net',
      id: 'REACT_1',
      fromMe: false,
    },
    message: {
      reactionMessage: { text: '❤️' },
    },
  } as any;
  assert.equal(normalizeBaileysMessage(reactionMsg), null);

  // History sync notification
  const syncMsg = {
    key: {
      remoteJid: '919876543210@s.whatsapp.net',
      id: 'SYNC_1',
      fromMe: false,
    },
    message: {
      historySyncNotification: { syncType: 1 },
    },
  } as any;
  assert.equal(normalizeBaileysMessage(syncMsg), null);

  // Empty text message
  const emptyMsg = {
    key: {
      remoteJid: '919876543210@s.whatsapp.net',
      id: 'EMPTY_1',
      fromMe: false,
    },
    message: {
      conversation: '   ',
    },
  } as any;
  assert.equal(normalizeBaileysMessage(emptyMsg), null);
});

test('WhatsApp Events: Unwrap ephemeral and view-once wrapped messages', () => {
  // Ephemeral wrapped text
  const ephemeralMsg = {
    key: {
      remoteJid: '919876543210@s.whatsapp.net',
      id: 'EPH_1',
      fromMe: false,
    },
    message: {
      ephemeralMessage: {
        message: {
          conversation: 'Ephemeral secret message',
        },
      },
    },
    pushName: 'Charlie',
  } as any;

  const normalizedEph = normalizeBaileysMessage(ephemeralMsg);
  assert.ok(normalizedEph);
  assert.equal(normalizedEph.type, 'text');
  assert.equal(normalizedEph.text, 'Ephemeral secret message');

  // View-once wrapped image
  const viewOnceMsg = {
    key: {
      remoteJid: '919876543210@s.whatsapp.net',
      id: 'VO_1',
      fromMe: false,
    },
    message: {
      viewOnceMessage: {
        message: {
          imageMessage: {
            url: 'https://example.com/view-once.jpg',
            caption: 'Look once',
          },
        },
      },
    },
  } as any;

  const normalizedVO = normalizeBaileysMessage(viewOnceMsg);
  assert.ok(normalizedVO);
  assert.equal(normalizedVO.type, 'image');
  assert.equal(normalizedVO.caption, 'Look once');
  assert.equal(normalizedVO.mediaUrl, 'https://example.com/view-once.jpg');
});

test('WhatsApp Events: Normalize interactive button responses', () => {
  const buttonMsg = {
    key: {
      remoteJid: '919876543210@s.whatsapp.net',
      id: 'BTN_RESP_1',
      fromMe: false,
    },
    message: {
      buttonsResponseMessage: {
        selectedDisplayText: 'Yes, please proceed',
        selectedButtonId: 'btn_yes',
      },
    },
  } as any;

  const normalized = normalizeBaileysMessage(buttonMsg);
  assert.ok(normalized);
  assert.equal(normalized.type, 'text');
  assert.equal(normalized.text, 'Yes, please proceed');
});

test('WhatsApp Events: Normalize modern native flow interactive button response', () => {
  const nativeBtnMsg = {
    key: {
      remoteJid: '919876543210@s.whatsapp.net',
      id: 'NATIVE_BTN_RESP_1',
      fromMe: false,
    },
    message: {
      interactiveResponseMessage: {
        body: {
          text: 'Confirm Order',
        },
        nativeFlowResponseMessage: {
          name: 'quick_reply',
          paramsJson: JSON.stringify({ id: 'btn_confirm', title: 'Confirm Order' }),
          version: 3,
        },
        contextInfo: {
          stanzaId: 'OUTBOUND_123',
        },
      },
    },
  } as any;

  const normalized = normalizeBaileysMessage(nativeBtnMsg);
  assert.ok(normalized);
  assert.equal(normalized.type, 'text');
  assert.equal(normalized.text, 'Confirm Order');
  assert.equal(normalized.quotedMessageId, 'OUTBOUND_123');
});

test('WhatsApp Events: Normalize native flow single_select list response', () => {
  const listMsg = {
    key: {
      remoteJid: '919876543210@s.whatsapp.net',
      id: 'NATIVE_LIST_RESP_1',
      fromMe: false,
    },
    message: {
      interactiveResponseMessage: {
        nativeFlowResponseMessage: {
          name: 'single_select',
          paramsJson: JSON.stringify({ id: 'opt_consultation' }),
          version: 3,
        },
      },
    },
  } as any;

  const normalized = normalizeBaileysMessage(listMsg);
  assert.ok(normalized);
  assert.equal(normalized.type, 'text');
  assert.equal(normalized.text, 'opt_consultation');
});
