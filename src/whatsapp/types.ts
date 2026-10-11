export interface NormalizedMessage {
  id: string;
  remoteJid: string;
  senderJid: string;
  pushName: string | null;
  fromMe: boolean;
  isGroup: boolean;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact' | 'sticker' | 'poll' | 'poll_update' | 'reaction' | 'protocol' | 'other';
  text: string | null;
  caption: string | null;
  mediaUrl: string | null;
  mimetype: string | null;
  timestamp: number;
  quotedMessageId?: string | null;
  poll?: {
    question: string;
    options: string[];
    selectableCount?: number;
  };
  pollUpdate?: {
    pollCreationMessageKey: any;
    selectedOptions?: string[];
    voteTimestamp?: number;
  };
  reaction?: {
    text: string;
    messageId: string;
  };
  protocol?: {
    type: 'revoke' | 'ephemeral' | 'edit';
    targetMessageId?: string;
    newText?: string;
  };
  raw: any;
}

export interface SendTextParams {
  instanceId: string;
  remoteJid: string;
  text: string;
  quotedMessageId?: string;
}

export interface SendMediaParams {
  instanceId: string;
  remoteJid: string;
  mediaUrl?: string;
  base64?: string;
  mediaType: 'image' | 'video' | 'document';
  mimeType: string;
  caption?: string;
  fileName?: string;
  isPtv?: boolean;
  quotedMessageId?: string;
}

export interface SendAudioParams {
  instanceId: string;
  remoteJid: string;
  audioUrl?: string;
  base64?: string;
  mimeType?: string;
  isVoiceNote?: boolean;
  quotedMessageId?: string;
}

export interface SendLocationParams {
  instanceId: string;
  remoteJid: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  quotedMessageId?: string;
}

export interface SendContactParams {
  instanceId: string;
  remoteJid: string;
  displayName: string;
  vcard: string;
  quotedMessageId?: string;
}

export interface SendStickerParams {
  instanceId: string;
  remoteJid: string;
  stickerUrl?: string;
  base64?: string;
  packName?: string;
  authorName?: string;
  quotedMessageId?: string;
}

export interface SendPollParams {
  instanceId: string;
  remoteJid: string;
  name: string;
  values: string[];
  selectableCount?: number;
  quotedMessageId?: string;
}

export interface EditMessageParams {
  instanceId: string;
  remoteJid: string;
  messageId: string;
  newText: string;
}

export interface DeleteMessageParams {
  instanceId: string;
  remoteJid: string;
  messageId: string;
}

export interface ReadMessagesParams {
  instanceId: string;
  remoteJid: string;
  messageIds: string[];
}

export interface CreateGroupParams {
  instanceId: string;
  subject: string;
  participants: string[];
}

export interface GroupParticipantsUpdateParams {
  instanceId: string;
  groupJid: string;
  participants: string[];
  action: 'add' | 'remove' | 'promote' | 'demote';
}

export interface UpdateGroupSubjectParams {
  instanceId: string;
  groupJid: string;
  subject: string;
}

export interface UpdateGroupDescriptionParams {
  instanceId: string;
  groupJid: string;
  description: string;
}

export interface GroupInviteCodeParams {
  instanceId: string;
  groupJid: string;
}

export interface JoinGroupViaInviteParams {
  instanceId: string;
  inviteCode: string;
}

export interface UpdateGroupSettingParams {
  instanceId: string;
  groupJid: string;
  setting: 'announcement' | 'not_announcement' | 'locked' | 'unlocked';
}

export interface LeaveGroupParams {
  instanceId: string;
  groupJid: string;
}

