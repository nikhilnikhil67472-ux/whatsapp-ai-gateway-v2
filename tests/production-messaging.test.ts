import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/server/index.js';
import { db } from '../src/db/database.js';
import { generateApiKey } from '../src/security/crypto.js';
import { WhatsAppEngineManager } from '../src/whatsapp/manager.js';
import {
  sendText,
  sendMedia,
  sendAudio,
  sendLocation,
  sendContact,
  sendReaction,
  sendPresence,
  checkWhatsAppNumber,
  sendSticker,
  sendPoll,
  editMessage,
  deleteMessage,
  readMessages,
} from '../src/whatsapp/sender.js';
import * as groupOps from '../src/whatsapp/groups.js';
import { processOutboundMessagesQueue } from '../src/queue/sqlite-queue.js';

test('Production Messaging: Rock-Solid Native Primitives & Deprecation Suite', async (t) => {
  const instanceName = 'test_prod_inst_' + Date.now();
  const created = db.createInstance({
    instance_name: instanceName,
    pairing_phone: '919876543210',
    sandbox_mode: false,
  });
  const instanceId = created.id;

  const { key, hash } = generateApiKey();
  db.createApiKeyRecord('Test Key Prod Messaging', hash, key.slice(0, 8));

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const authHeaders = {
    'Content-Type': 'application/json',
    'x-api-key': key,
  };

  t.after(() => {
    server.close();
    WhatsAppEngineManager.removeSocket(instanceId);
    db.deleteInstance(instanceId);
  });

  await t.test('Deprecation: POST /whatsapp/send-interactive returns HTTP 410 Gone with poll migration path', async () => {
    const res = await fetch(`${baseUrl}/api/v1/whatsapp/send-interactive`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        instance_id: instanceId,
        remote_jid: '919876543210@s.whatsapp.net',
        type: 'buttons',
        text: 'Legacy buttons attempt',
        buttons: [{ id: 'b1', text: 'Option 1' }],
      }),
    });

    assert.equal(res.status, 410, 'Must return HTTP 410 Gone');
    const data = (await res.json()) as any;
    assert.equal(data.success, false);
    assert.ok(data.error.includes('Interactive buttons and lists are deprecated'));
    assert.ok(data.error.includes('/api/v1/whatsapp/send-poll'));
    assert.equal(data.migration?.recommended_endpoint, '/api/v1/whatsapp/send-poll');
    assert.equal(data.migration?.example?.name, 'Legacy buttons attempt');
    assert.deepEqual(data.migration?.example?.values, ['Option 1', 'Option 2']);
  });

  await t.test('Sender: sendText dispatches with composing presence simulation and quotes', async () => {
    const presenceLog: string[] = [];
    let sentJid: string | null = null;
    let sentContent: any = null;
    let sentOptions: any = null;

    const mockSocket: any = {
      user: { id: '919876543210@s.whatsapp.net' },
      presenceSubscribe: async () => {},
      sendPresenceUpdate: async (type: string) => {
        presenceLog.push(type);
      },
      sendMessage: async (jid: string, content: any, options: any) => {
        sentJid = jid;
        sentContent = content;
        sentOptions = options;
        return { key: { id: 'MSG_TEXT_001', remoteJid: jid } };
      },
    };

    WhatsAppEngineManager.setSocket(instanceId, mockSocket);

    const result = await sendText({
      instanceId,
      remoteJid: '919123456789@s.whatsapp.net',
      text: 'Hello from Production WhatsApp AI Gateway!',
      quotedMessageId: 'QUOTE_123',
    });

    assert.equal(result.key.id, 'MSG_TEXT_001');
    assert.equal(sentJid, '919123456789@s.whatsapp.net');
    assert.equal(sentContent.text, 'Hello from Production WhatsApp AI Gateway!');
    assert.equal(sentOptions.quoted?.key?.id, 'QUOTE_123');
    assert.ok(presenceLog.includes('composing'), 'Must simulate composing presence');
    assert.ok(presenceLog.includes('paused'), 'Must reset presence to paused in finally block');
  });

  await t.test('Sender: sendMedia handles image and video with PTV note flags', async () => {
    let sentContent: any = null;
    const mockSocket: any = {
      user: { id: '919876543210@s.whatsapp.net' },
      presenceSubscribe: async () => {},
      sendPresenceUpdate: async () => {},
      sendMessage: async (_jid: string, content: any) => {
        sentContent = content;
        return { key: { id: 'MSG_MEDIA_001' } };
      },
    };

    WhatsAppEngineManager.setSocket(instanceId, mockSocket);

    // 1. Image
    const sampleBase64 = Buffer.from('fake-image-bytes').toString('base64');
    await sendMedia({
      instanceId,
      remoteJid: '919123456789@s.whatsapp.net',
      mediaType: 'image',
      base64: `data:image/png;base64,${sampleBase64}`,
      caption: 'Look at this chart',
    });
    assert.ok(sentContent.image);
    assert.equal(sentContent.caption, 'Look at this chart');

    // 2. Video with PTV (round video note)
    await sendMedia({
      instanceId,
      remoteJid: '919123456789@s.whatsapp.net',
      mediaType: 'video',
      base64: `data:video/mp4;base64,${sampleBase64}`,
      isPtv: true,
    });
    assert.ok(sentContent.video);
    assert.equal(sentContent.ptv, true, 'PTV flag must be enabled for circular video note');
  });

  await t.test('Sender: sendAudio delivers PTT voice note with recording presence', async () => {
    const presenceLog: string[] = [];
    let sentContent: any = null;

    const mockSocket: any = {
      user: { id: '919876543210@s.whatsapp.net' },
      presenceSubscribe: async () => {},
      sendPresenceUpdate: async (type: string) => {
        presenceLog.push(type);
      },
      sendMessage: async (_jid: string, content: any) => {
        sentContent = content;
        return { key: { id: 'MSG_AUDIO_001' } };
      },
    };

    WhatsAppEngineManager.setSocket(instanceId, mockSocket);

    const audioBase64 = Buffer.from('fake-audio-bytes').toString('base64');
    await sendAudio({
      instanceId,
      remoteJid: '919123456789@s.whatsapp.net',
      base64: `data:audio/ogg;base64,${audioBase64}`,
      isVoiceNote: true,
    });

    assert.ok(sentContent.audio);
    assert.equal(sentContent.ptt, true, 'ptt must be true for voice notes');
    assert.ok(presenceLog.includes('recording'), 'Must simulate recording presence');
    assert.ok(presenceLog.includes('paused'), 'Must pause presence after sending');
  });

  await t.test('Sender: sendLocation and sendContact deliver structured vcard & coords', async () => {
    let sentContent: any = null;

    const mockSocket: any = {
      user: { id: '919876543210@s.whatsapp.net' },
      presenceSubscribe: async () => {},
      sendPresenceUpdate: async () => {},
      sendMessage: async (_jid: string, content: any) => {
        sentContent = content;
        return { key: { id: 'MSG_LOC_001' } };
      },
    };

    WhatsAppEngineManager.setSocket(instanceId, mockSocket);

    // Location
    await sendLocation({
      instanceId,
      remoteJid: '919123456789@s.whatsapp.net',
      latitude: 37.7749,
      longitude: -122.4194,
      name: 'San Francisco HQ',
      address: 'Market Street',
    });
    assert.equal(sentContent.location.degreesLatitude, 37.7749);
    assert.equal(sentContent.location.degreesLongitude, -122.4194);
    assert.equal(sentContent.location.name, 'San Francisco HQ');

    // Contact
    await sendContact({
      instanceId,
      remoteJid: '919123456789@s.whatsapp.net',
      displayName: 'Jane Doe Support',
      vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN:Jane Doe Support\nTEL;TYPE=CELL:+123456789\nEND:VCARD',
    });
    assert.equal(sentContent.contacts.displayName, 'Jane Doe Support');
    assert.ok(sentContent.contacts.contacts[0].vcard.includes('Jane Doe Support'));
  });

  await t.test('Sender: sendReaction and sendPresence dispatch correctly', async () => {
    let reactionContent: any = null;
    let presenceType: string | null = null;
    let presenceJid: string | null = null;

    const mockSocket: any = {
      user: { id: '919876543210@s.whatsapp.net' },
      presenceSubscribe: async () => {},
      sendPresenceUpdate: async (type: string, jid?: string) => {
        presenceType = type;
        presenceJid = jid || null;
      },
      sendMessage: async (_jid: string, content: any) => {
        reactionContent = content;
        return { key: { id: 'REACT_001' } };
      },
    };

    WhatsAppEngineManager.setSocket(instanceId, mockSocket);

    // Reaction
    await sendReaction({
      instanceId,
      remoteJid: '919123456789@s.whatsapp.net',
      messageId: 'TARGET_MSG_001',
      emoji: '🔥',
    });
    assert.equal(reactionContent.react.text, '🔥');
    assert.equal(reactionContent.react.key.id, 'TARGET_MSG_001');

    // Presence
    await sendPresence({
      instanceId,
      remoteJid: '919123456789@s.whatsapp.net',
      presence: 'composing',
    });
    assert.equal(presenceType, 'composing');
    assert.equal(presenceJid, '919123456789@s.whatsapp.net');
  });

  await t.test('Sender: checkWhatsAppNumber queries socket.onWhatsApp', async () => {
    const mockSocket: any = {
      user: { id: '919876543210@s.whatsapp.net' },
      onWhatsApp: async (phone: string) => {
        if (phone === '919876543210') {
          return [{ exists: true, jid: '919876543210@s.whatsapp.net' }];
        }
        return [];
      },
    };

    WhatsAppEngineManager.setSocket(instanceId, mockSocket);

    const check1 = await checkWhatsAppNumber(instanceId, '+91 98765 43210');
    assert.equal(check1.exists, true);
    assert.equal(check1.jid, '919876543210@s.whatsapp.net');

    const check2 = await checkWhatsAppNumber(instanceId, '910000000000');
    assert.equal(check2.exists, false);
    assert.equal(check2.jid, '910000000000@s.whatsapp.net');
  });

  await t.test('Sender: sendSticker injects EXIF metadata and dispatches sticker message', async () => {
    let sentContent: any = null;
    const mockSocket: any = {
      user: { id: '919876543210@s.whatsapp.net' },
      presenceSubscribe: async () => {},
      sendPresenceUpdate: async () => {},
      sendMessage: async (_jid: string, content: any) => {
        sentContent = content;
        return { key: { id: 'STICKER_MSG_001' } };
      },
    };

    WhatsAppEngineManager.setSocket(instanceId, mockSocket);

    const fakeWebp = Buffer.from('RIFF....WEBPVP8 ....');
    const result = await sendSticker({
      instanceId,
      remoteJid: '919123456789@s.whatsapp.net',
      base64: fakeWebp.toString('base64'),
      packName: 'BrandPack',
      authorName: 'AI Brand',
    });

    assert.equal(result.key.id, 'STICKER_MSG_001');
    assert.ok(sentContent.sticker, 'Must contain sticker buffer');
    assert.ok(Buffer.isBuffer(sentContent.sticker));
  });

  await t.test('Sender: sendPoll constructs Baileys poll message with multi-choice options', async () => {
    let sentContent: any = null;
    const mockSocket: any = {
      user: { id: '919876543210@s.whatsapp.net' },
      presenceSubscribe: async () => {},
      sendPresenceUpdate: async () => {},
      sendMessage: async (_jid: string, content: any) => {
        sentContent = content;
        return { key: { id: 'POLL_MSG_001' } };
      },
    };

    WhatsAppEngineManager.setSocket(instanceId, mockSocket);

    const result = await sendPoll({
      instanceId,
      remoteJid: '919123456789@s.whatsapp.net',
      name: 'Which deployment option do you prefer?',
      values: ['Docker Compose (1-click)', 'Kubernetes Helm', 'Direct Node.js'],
      selectableCount: 1,
    });

    assert.equal(result.key.id, 'POLL_MSG_001');
    assert.ok(sentContent.poll);
    assert.equal(sentContent.poll.name, 'Which deployment option do you prefer?');
    assert.deepEqual(sentContent.poll.values, ['Docker Compose (1-click)', 'Kubernetes Helm', 'Direct Node.js']);
    assert.equal(sentContent.poll.selectableCount, 1);
  });

  await t.test('Sender: editMessage, deleteMessage, and readMessages execute Baileys primitives', async () => {
    let editContent: any = null;
    let deleteContent: any = null;
    let readKeys: any = null;

    const mockSocket: any = {
      user: { id: '919876543210@s.whatsapp.net' },
      sendMessage: async (_jid: string, content: any) => {
        if (content.edit) editContent = content;
        if (content.delete) deleteContent = content;
        return { key: { id: 'OP_OK' } };
      },
      readMessages: async (keys: any) => {
        readKeys = keys;
        return true;
      },
    };

    WhatsAppEngineManager.setSocket(instanceId, mockSocket);

    // Edit
    await editMessage({
      instanceId,
      remoteJid: '919123456789@s.whatsapp.net',
      messageId: 'MSG_EDIT_TARGET',
      newText: 'Updated revised message text',
    });
    assert.equal(editContent.text, 'Updated revised message text');
    assert.equal(editContent.edit.id, 'MSG_EDIT_TARGET');
    assert.equal(editContent.edit.fromMe, true);

    // Delete
    await deleteMessage({
      instanceId,
      remoteJid: '919123456789@s.whatsapp.net',
      messageId: 'MSG_DELETE_TARGET',
    });
    assert.equal(deleteContent.delete.id, 'MSG_DELETE_TARGET');
    assert.equal(deleteContent.delete.fromMe, true);

    // Read
    await readMessages({
      instanceId,
      remoteJid: '919123456789@s.whatsapp.net',
      messageIds: ['MSG_1', 'MSG_2'],
    });
    assert.equal(readKeys.length, 2);
    assert.equal(readKeys[0].id, 'MSG_1');
    assert.equal(readKeys[1].id, 'MSG_2');
  });

  await t.test('Queue Worker: Dispatches text, media, sticker, and poll jobs successfully', async () => {
    const dispatchedTypes: string[] = [];

    const mockSocket: any = {
      user: { id: '919876543210@s.whatsapp.net' },
      presenceSubscribe: async () => {},
      sendPresenceUpdate: async () => {},
      sendMessage: async (_jid: string, content: any) => {
        if (content.text) dispatchedTypes.push('text');
        else if (content.image || content.video || content.document) dispatchedTypes.push('media');
        else if (content.sticker) dispatchedTypes.push('sticker');
        else if (content.poll) dispatchedTypes.push('poll');
        return { key: { id: 'QUEUE_MSG_' + Date.now() } };
      },
    };

    WhatsAppEngineManager.setSocket(instanceId, mockSocket);

    const fakeBuf = Buffer.from('test data').toString('base64');

    // 1. Enqueue text
    const m1 = db.enqueueOutboundMessage({
      instance_id: instanceId,
      remote_jid: '919111111111@s.whatsapp.net',
      reply_type: 'text',
      text_content: 'Queue text item',
    });

    // 2. Enqueue media
    const m2 = db.enqueueOutboundMessage({
      instance_id: instanceId,
      remote_jid: '919222222222@s.whatsapp.net',
      reply_type: 'media',
      media_type: 'image',
      text_content: 'Image caption',
      payload: { base64: `data:image/png;base64,${fakeBuf}` },
    });

    // 3. Enqueue sticker
    const m3 = db.enqueueOutboundMessage({
      instance_id: instanceId,
      remote_jid: '919333333333@s.whatsapp.net',
      reply_type: 'sticker',
      payload: {
        base64: fakeBuf,
        packName: 'QueuePack',
        authorName: 'QueueAuthor',
      },
    });

    // 4. Enqueue poll
    const m4 = db.enqueueOutboundMessage({
      instance_id: instanceId,
      remote_jid: '919444444444@s.whatsapp.net',
      reply_type: 'poll',
      text_content: 'What is your favorite cloud?',
      payload: {
        pollName: 'What is your favorite cloud?',
        values: ['AWS', 'GCP', 'Azure'],
        selectableCount: 1,
      },
    });

    // Process all queue items
    let totalProcessed = 0;
    while (true) {
      const count = await processOutboundMessagesQueue();
      if (count === 0) break;
      totalProcessed += count;
    }

    assert.ok(totalProcessed >= 4, 'Must process at least the 4 enqueued messages');
    assert.ok(dispatchedTypes.includes('text'), 'Queue worker must handle text');
    assert.ok(dispatchedTypes.includes('media'), 'Queue worker must handle media');
    assert.ok(dispatchedTypes.includes('sticker'), 'Queue worker must handle sticker');
    assert.ok(dispatchedTypes.includes('poll'), 'Queue worker must handle poll');

    // Verify database state is 'sent'
    assert.equal(db.getOutboundMessage(m1)?.status, 'sent');
    assert.equal(db.getOutboundMessage(m2)?.status, 'sent');
    assert.equal(db.getOutboundMessage(m3)?.status, 'sent');
    assert.equal(db.getOutboundMessage(m4)?.status, 'sent');
  });

  await t.test('REST API: /whatsapp/send auto-enqueues sticker and poll payloads cleanly', async () => {
    // 1. Send sticker via /whatsapp/send
    const resSticker = await fetch(`${baseUrl}/api/v1/whatsapp/send`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        instance_id: instanceId,
        remote_jid: '919876543210',
        type: 'sticker',
        base64: Buffer.from('sticker-bytes').toString('base64'),
        pack_name: 'ApiPack',
        author_name: 'ApiAuthor',
      }),
    });
    assert.equal(resSticker.status, 202);
    const dSticker = (await resSticker.json()) as any;
    assert.equal(dSticker.status, 'pending');
    const msgSticker = db.getOutboundMessage(dSticker.message_id);
    assert.equal(msgSticker?.reply_type, 'sticker');
    assert.equal(msgSticker?.payload?.packName, 'ApiPack');

    // 2. Send poll via /whatsapp/send
    const resPoll = await fetch(`${baseUrl}/api/v1/whatsapp/send`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        instance_id: instanceId,
        remote_jid: '919876543210',
        type: 'poll',
        poll_name: 'Vote for gateway upgrade',
        poll_values: ['Upgrade Now', 'Upgrade Later'],
        selectable_count: 1,
      }),
    });
    assert.equal(resPoll.status, 202);
    const dPoll = (await resPoll.json()) as any;
    assert.equal(dPoll.status, 'pending');
    const msgPoll = db.getOutboundMessage(dPoll.message_id);
    assert.equal(msgPoll?.reply_type, 'poll');
    assert.equal(msgPoll?.payload?.pollName, 'Vote for gateway upgrade');
    assert.deepEqual(msgPoll?.payload?.values, ['Upgrade Now', 'Upgrade Later']);
  });

  await t.test('REST API: Direct /whatsapp/send-poll dispatches immediately via sender', async () => {
    let capturedPollContent: any = null;
    const mockSocket: any = {
      user: { id: '919876543210@s.whatsapp.net' },
      presenceSubscribe: async () => {},
      sendPresenceUpdate: async () => {},
      sendMessage: async (_jid: string, content: any) => {
        capturedPollContent = content;
        return { key: { id: 'DIRECT_POLL_123' } };
      },
    };

    WhatsAppEngineManager.setSocket(instanceId, mockSocket);

    const res = await fetch(`${baseUrl}/api/v1/whatsapp/send-poll`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        instance_id: instanceId,
        remote_jid: '919876543210',
        name: 'Favorite LLM for WhatsApp agents?',
        values: ['Claude 3.7 Sonnet', 'GPT-4o', 'DeepSeek-R1'],
        selectable_count: 1,
      }),
    });

    assert.equal(res.status, 200);
    const json = (await res.json()) as any;
    assert.equal(json.success, true);
    assert.equal(json.result.key.id, 'DIRECT_POLL_123');
    assert.equal(capturedPollContent.poll.name, 'Favorite LLM for WhatsApp agents?');
    assert.deepEqual(capturedPollContent.poll.values, ['Claude 3.7 Sonnet', 'GPT-4o', 'DeepSeek-R1']);
  });

  await t.test('Queue Worker & REST: Handles PTV video notes (is_ptv) and plain audio files (is_voice_note: false) cleanly', async () => {
    let capturedVideoContent: any = null;
    let capturedAudioContent: any = null;

    const mockSocket: any = {
      user: { id: '919876543210@s.whatsapp.net' },
      presenceSubscribe: async () => {},
      sendPresenceUpdate: async () => {},
      sendMessage: async (_jid: string, content: any) => {
        if (content.video) capturedVideoContent = content;
        if (content.audio) capturedAudioContent = content;
        return { key: { id: 'PTV_AUDIO_' + Date.now() } };
      },
    };

    WhatsAppEngineManager.setSocket(instanceId, mockSocket);

    const fakeBuf = Buffer.from('sample media bytes').toString('base64');

    // 1. Enqueue PTV video note via /whatsapp/send
    const resPtv = await fetch(`${baseUrl}/api/v1/whatsapp/send`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        instance_id: instanceId,
        remote_jid: '919888888888',
        type: 'media',
        media_type: 'video',
        base64: `data:video/mp4;base64,${fakeBuf}`,
        is_ptv: true,
      }),
    });
    assert.equal(resPtv.status, 202);
    const dPtv = (await resPtv.json()) as any;
    assert.equal(dPtv.status, 'pending');

    // 2. Enqueue audio file with is_voice_note: false via /whatsapp/send
    const resAudio = await fetch(`${baseUrl}/api/v1/whatsapp/send`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        instance_id: instanceId,
        remote_jid: '919777777777',
        type: 'audio',
        base64: `data:audio/mp3;base64,${fakeBuf}`,
        is_voice_note: false,
      }),
    });
    assert.equal(resAudio.status, 202);
    const dAudio = (await resAudio.json()) as any;
    assert.equal(dAudio.status, 'pending');

    // Process queued messages
    while (true) {
      const count = await processOutboundMessagesQueue();
      if (count === 0) break;
    }

    assert.ok(capturedVideoContent, 'Must have dispatched video message');
    assert.equal(capturedVideoContent.ptv, true, 'is_ptv must propagate through queue to socket.ptv');
    assert.equal(capturedVideoContent.mimetype, 'video/mp4', 'MIME must default to video/mp4');

    assert.ok(capturedAudioContent, 'Must have dispatched audio message');
    assert.equal(capturedAudioContent.ptt, false, 'is_voice_note: false must propagate through queue to socket.ptt: false');
  });

  await t.test('Group Administration: Executes all 10 operations (create, metadata, subject, description, participants, invite-code, revoke-invite, join, settings, leave)', async () => {
    let subjectUpdated: string | null = null;
    let descriptionUpdated: string | null = null;
    let participantsAction: string | null = null;
    let settingUpdated: string | null = null;
    let leftGroup: string | null = null;

    const mockSocket: any = {
      user: { id: '919876543210@s.whatsapp.net' },
      groupCreate: async (subject: string, participants: string[]) => ({
        id: '120363000000000001@g.us',
        subject,
        participants,
      }),
      groupMetadata: async (groupJid: string) => ({
        id: groupJid,
        subject: 'Engineering Team',
        participants: [{ id: '919876543210@s.whatsapp.net', admin: 'superadmin' }],
      }),
      groupUpdateSubject: async (_groupJid: string, subject: string) => {
        subjectUpdated = subject;
        return true;
      },
      groupUpdateDescription: async (_groupJid: string, description: string) => {
        descriptionUpdated = description;
        return true;
      },
      groupParticipantsUpdate: async (_groupJid: string, _participants: string[], action: string) => {
        participantsAction = action;
        return [{ status: '200' }];
      },
      groupInviteCode: async () => 'INVITECODE123',
      groupRevokeInvite: async () => 'NEWINVITECODE456',
      groupAcceptInvite: async () => '120363000000000002@g.us',
      groupSettingUpdate: async (_groupJid: string, setting: string) => {
        settingUpdated = setting;
        return true;
      },
      groupLeave: async (groupJid: string) => {
        leftGroup = groupJid;
        return true;
      },
    };

    WhatsAppEngineManager.setSocket(instanceId, mockSocket);

    // 1. Create Group
    const gCreate = await groupOps.createGroup({
      instanceId,
      subject: 'DevOps Squad',
      participants: ['919123456789'],
    });
    assert.equal(gCreate.id, '120363000000000001@g.us');
    assert.equal(gCreate.subject, 'DevOps Squad');

    // 2. Metadata
    const gMeta = await groupOps.getGroupMetadata(instanceId, '120363000000000001@g.us');
    assert.equal(gMeta.subject, 'Engineering Team');

    // 3. Update Subject
    await groupOps.updateGroupSubject({
      instanceId,
      groupJid: '120363000000000001@g.us',
      subject: 'Updated Squad Name',
    });
    assert.equal(subjectUpdated, 'Updated Squad Name');

    // 4. Update Description
    await groupOps.updateGroupDescription({
      instanceId,
      groupJid: '120363000000000001@g.us',
      description: 'New squad description',
    });
    assert.equal(descriptionUpdated, 'New squad description');

    // 5. Participants Update
    await groupOps.updateGroupParticipants({
      instanceId,
      groupJid: '120363000000000001@g.us',
      participants: ['919123456789'],
      action: 'promote',
    });
    assert.equal(participantsAction, 'promote');

    // 6. Get Invite Code
    const gInvite = await groupOps.getGroupInviteCode({
      instanceId,
      groupJid: '120363000000000001@g.us',
    });
    assert.equal(gInvite.code, 'INVITECODE123');
    assert.equal(gInvite.inviteUrl, 'https://chat.whatsapp.com/INVITECODE123');

    // 7. Revoke Invite Code
    const gRevoke = await groupOps.revokeGroupInviteCode({
      instanceId,
      groupJid: '120363000000000001@g.us',
    });
    assert.equal(gRevoke.code, 'NEWINVITECODE456');

    // 8. Join Group
    const gJoin = await groupOps.joinGroupViaInvite({
      instanceId,
      inviteCode: 'INVITECODE123',
    });
    assert.equal(gJoin.groupJid, '120363000000000002@g.us');

    // 9. Update Setting
    await groupOps.updateGroupSetting({
      instanceId,
      groupJid: '120363000000000001@g.us',
      setting: 'announcement',
    });
    assert.equal(settingUpdated, 'announcement');

    // 10. Leave Group
    await groupOps.leaveGroup({
      instanceId,
      groupJid: '120363000000000001@g.us',
    });
    assert.equal(leftGroup, '120363000000000001@g.us');
  });

  await t.test('Model Context Protocol: Executes wag_send_poll and wag_manage_group tools via JSON-RPC', async () => {
    let mcpPollContent: any = null;

    const mockSocket: any = {
      user: { id: '919876543210@s.whatsapp.net' },
      presenceSubscribe: async () => {},
      sendPresenceUpdate: async () => {},
      sendMessage: async (_jid: string, content: any) => {
        if (content.poll) mcpPollContent = content;
        return { key: { id: 'MCP_POLL_OK' } };
      },
      groupCreate: async (subject: string) => ({
        id: '120363000000000099@g.us',
        subject,
      }),
    };

    WhatsAppEngineManager.setSocket(instanceId, mockSocket);

    // Call wag_send_poll via MCP
    const resMcpPoll = await fetch(`${baseUrl}/api/v1/mcp`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 101,
        method: 'tools/call',
        params: {
          name: 'wag_send_poll',
          arguments: {
            instanceId,
            remoteJid: '919876543210@s.whatsapp.net',
            name: 'Rate our AI Gateway',
            values: ['⭐⭐⭐⭐⭐ 5 Stars', '⭐⭐⭐⭐ 4 Stars'],
            selectableCount: 1,
          },
        },
      }),
    });

    assert.equal(resMcpPoll.status, 200);
    const mcpPollJson = (await resMcpPoll.json()) as any;
    assert.equal(mcpPollJson.id, 101);
    assert.ok(mcpPollJson.result?.content);
    assert.ok(mcpPollContent);
    assert.equal(mcpPollContent.poll.name, 'Rate our AI Gateway');

    // Call wag_manage_group via MCP
    const resMcpGroup = await fetch(`${baseUrl}/api/v1/mcp`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 102,
        method: 'tools/call',
        params: {
          name: 'wag_manage_group',
          arguments: {
            instanceId,
            action: 'create',
            subject: 'MCP Automated Group',
            participants: ['919876543210'],
          },
        },
      }),
    });

    assert.equal(resMcpGroup.status, 200);
    const mcpGroupJson = (await resMcpGroup.json()) as any;
    assert.equal(mcpGroupJson.id, 102);
    assert.ok(mcpGroupJson.result?.content);
    assert.ok(mcpGroupJson.result.content[0].text.includes('120363000000000099@g.us'));
  });
});
