export const groupOperations = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: {
        resource: ['group'],
      },
    },
    options: [
      {
        name: 'Create Group',
        value: 'create',
        description: 'Create a new WhatsApp group with participants',
        action: 'Create a group',
      },
      {
        name: 'Get Group Metadata',
        value: 'getMetadata',
        description: 'Fetch group profile, participants, description, and admin roles',
        action: 'Get group metadata',
      },
      {
        name: 'Update Subject (Title)',
        value: 'updateSubject',
        description: 'Change group subject / display title',
        action: 'Update group subject',
      },
      {
        name: 'Update Description',
        value: 'updateDescription',
        description: 'Change group description topic text',
        action: 'Update group description',
      },
      {
        name: 'Manage Participants',
        value: 'manageParticipants',
        description: 'Add, remove, promote, or demote participants in a group',
        action: 'Manage group participants',
      },
      {
        name: 'Get Invite Code',
        value: 'getInviteCode',
        description: 'Retrieve group invite code and join URL',
        action: 'Get group invite code',
      },
      {
        name: 'Revoke Invite Code',
        value: 'revokeInvite',
        description: 'Revoke existing invite link and generate a fresh link',
        action: 'Revoke group invite code',
      },
      {
        name: 'Join Group via Invite',
        value: 'join',
        description: 'Join a group using an invite code or invite link',
        action: 'Join group via invite',
      },
      {
        name: 'Update Group Settings',
        value: 'updateSettings',
        description: 'Toggle announcement mode or locked metadata mode',
        action: 'Update group settings',
      },
      {
        name: 'Leave Group',
        value: 'leave',
        description: 'Leave a WhatsApp group',
        action: 'Leave a group',
      },
    ],
    default: 'getMetadata',
  },
];

export const groupFields = [
  // Instance ID
  {
    displayName: 'Instance ID or Name',
    name: 'instanceId',
    type: 'string',
    default: 'default',
    required: true,
    displayOptions: {
      show: {
        resource: ['group'],
      },
    },
    description: 'WhatsApp instance identifier or name',
  },

  // Group JID
  {
    displayName: 'Group JID',
    name: 'groupJid',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['group'],
        operation: ['getMetadata', 'updateSubject', 'updateDescription', 'manageParticipants', 'getInviteCode', 'revokeInvite', 'updateSettings', 'leave'],
      },
    },
    description: 'Group JID (e.g. 120363000000000000@g.us)',
  },

  // Subject (Create & Update)
  {
    displayName: 'Group Subject',
    name: 'subject',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['group'],
        operation: ['create', 'updateSubject'],
      },
    },
    description: 'Title of the group',
  },

  // Description
  {
    displayName: 'Group Description',
    name: 'description',
    type: 'string',
    typeOptions: {
      rows: 3,
    },
    default: '',
    displayOptions: {
      show: {
        resource: ['group'],
        operation: ['updateDescription'],
      },
    },
    description: 'Description text of the group',
  },

  // Participants (Create & Manage)
  {
    displayName: 'Participants',
    name: 'participants',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['group'],
        operation: ['create', 'manageParticipants'],
      },
    },
    description: 'Comma-separated phone numbers or JIDs, e.g. 919876543210, 919876543211',
  },

  // Participant Action
  {
    displayName: 'Action',
    name: 'action',
    type: 'options',
    options: [
      { name: 'Add Participant', value: 'add' },
      { name: 'Remove Participant', value: 'remove' },
      { name: 'Promote to Admin', value: 'promote' },
      { name: 'Demote from Admin', value: 'demote' },
    ],
    default: 'add',
    displayOptions: {
      show: {
        resource: ['group'],
        operation: ['manageParticipants'],
      },
    },
    description: 'Operation to perform on the specified participants',
  },

  // Invite Code (Join)
  {
    displayName: 'Invite Code or URL',
    name: 'inviteCode',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        resource: ['group'],
        operation: ['join'],
      },
    },
    description: 'WhatsApp invite code or link (https://chat.whatsapp.com/...)',
  },

  // Group Setting
  {
    displayName: 'Setting',
    name: 'setting',
    type: 'options',
    options: [
      { name: 'Announcement Mode (Admins Only Can Send Messages)', value: 'announcement' },
      { name: 'Standard Mode (All Participants Can Send Messages)', value: 'not_announcement' },
      { name: 'Locked (Admins Only Can Edit Group Info)', value: 'locked' },
      { name: 'Unlocked (All Participants Can Edit Group Info)', value: 'unlocked' },
    ],
    default: 'announcement',
    displayOptions: {
      show: {
        resource: ['group'],
        operation: ['updateSettings'],
      },
    },
    description: 'Group permission policy to apply',
  },
];
