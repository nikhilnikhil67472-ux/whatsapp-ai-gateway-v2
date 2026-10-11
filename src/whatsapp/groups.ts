import { WASocket } from '@whiskeysockets/baileys';
import { WhatsAppEngineManager } from './manager.js';
import {
  CreateGroupParams,
  GroupParticipantsUpdateParams,
  UpdateGroupSubjectParams,
  UpdateGroupDescriptionParams,
  GroupInviteCodeParams,
  JoinGroupViaInviteParams,
  UpdateGroupSettingParams,
  LeaveGroupParams,
} from './types.js';

function getSocket(instanceId: string): WASocket {
  const socket = WhatsAppEngineManager.getSocket(instanceId);
  if (!socket) {
    throw new Error(`WhatsApp instance '${instanceId}' is not connected`);
  }
  return socket;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = 15000, errorMsg = 'Group operation timed out (15s)'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
    promise.then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

function cleanJid(id: string): string {
  if (id.includes('@')) return id;
  const digits = id.replace(/[^0-9]/g, '');
  return `${digits}@s.whatsapp.net`;
}

export async function createGroup(params: CreateGroupParams): Promise<any> {
  const socket = getSocket(params.instanceId);
  const participants = params.participants.map(cleanJid);
  return await withTimeout(
    socket.groupCreate(params.subject, participants),
    15000,
    `Create group timed out for "${params.subject}"`
  );
}

export async function getGroupMetadata(instanceId: string, groupJid: string): Promise<any> {
  const socket = getSocket(instanceId);
  return await withTimeout(
    socket.groupMetadata(groupJid),
    15000,
    `Get group metadata timed out for ${groupJid}`
  );
}

export async function updateGroupSubject(params: UpdateGroupSubjectParams): Promise<any> {
  const socket = getSocket(params.instanceId);
  return await withTimeout(
    socket.groupUpdateSubject(params.groupJid, params.subject),
    15000,
    `Update group subject timed out for ${params.groupJid}`
  );
}

export async function updateGroupDescription(params: UpdateGroupDescriptionParams): Promise<any> {
  const socket = getSocket(params.instanceId);
  return await withTimeout(
    socket.groupUpdateDescription(params.groupJid, params.description),
    15000,
    `Update group description timed out for ${params.groupJid}`
  );
}

export async function updateGroupParticipants(params: GroupParticipantsUpdateParams): Promise<any> {
  const socket = getSocket(params.instanceId);
  const participants = params.participants.map(cleanJid);
  return await withTimeout(
    socket.groupParticipantsUpdate(params.groupJid, participants, params.action),
    15000,
    `Update group participants (${params.action}) timed out for ${params.groupJid}`
  );
}

export async function getGroupInviteCode(params: GroupInviteCodeParams): Promise<{ code: string; inviteUrl: string }> {
  const socket = getSocket(params.instanceId);
  const code = await withTimeout(
    socket.groupInviteCode(params.groupJid),
    15000,
    `Get group invite code timed out for ${params.groupJid}`
  );
  const finalCode = code || '';
  return {
    code: finalCode,
    inviteUrl: finalCode ? `https://chat.whatsapp.com/${finalCode}` : '',
  };
}

export async function revokeGroupInviteCode(params: GroupInviteCodeParams): Promise<{ code: string | null; inviteUrl: string | null }> {
  const socket = getSocket(params.instanceId);
  const code = await withTimeout(
    socket.groupRevokeInvite(params.groupJid),
    15000,
    `Revoke group invite code timed out for ${params.groupJid}`
  );
  return {
    code: code || null,
    inviteUrl: code ? `https://chat.whatsapp.com/${code}` : null,
  };
}

export async function joinGroupViaInvite(params: JoinGroupViaInviteParams): Promise<{ groupJid: string }> {
  const socket = getSocket(params.instanceId);
  const cleanCode = params.inviteCode.replace('https://chat.whatsapp.com/', '').trim();
  const groupJid = await withTimeout(
    socket.groupAcceptInvite(cleanCode),
    15000,
    `Accept group invite timed out for code ${cleanCode}`
  );
  return { groupJid: groupJid || '' };
}

export async function updateGroupSetting(params: UpdateGroupSettingParams): Promise<any> {
  const socket = getSocket(params.instanceId);
  return await withTimeout(
    socket.groupSettingUpdate(params.groupJid, params.setting),
    15000,
    `Update group setting (${params.setting}) timed out for ${params.groupJid}`
  );
}

export async function leaveGroup(params: LeaveGroupParams): Promise<any> {
  const socket = getSocket(params.instanceId);
  return await withTimeout(
    socket.groupLeave(params.groupJid),
    15000,
    `Leave group timed out for ${params.groupJid}`
  );
}
