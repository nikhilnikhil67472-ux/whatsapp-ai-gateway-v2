export const mediaAiOperations = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: {
        resource: ['mediaAi'],
      },
    },
    options: [
      {
        name: 'Transcribe Audio / Voice Note (Whisper)',
        value: 'transcribeAudio',
        description: 'Transcribe inbound voice notes or audio files with Groq Whisper Turbo / OpenAI Whisper',
        action: 'Transcribe audio voice note',
      },
      {
        name: 'Analyze Image (Gemini Vision)',
        value: 'analyzeImage',
        description: 'Analyze an image, extract receipt data, OCR, or answer questions with Gemini Multimodal',
        action: 'Analyze image',
      },
    ],
    default: 'transcribeAudio',
  },
];

export const mediaAiFields = [
  // Transcribe Audio
  {
    displayName: 'Audio URL or Base64',
    name: 'audioSource',
    type: 'string',
    default: '',
    placeholder: 'https://example.com/voicenote.ogg or data:audio/ogg;base64,...',
    required: true,
    displayOptions: {
      show: {
        resource: ['mediaAi'],
        operation: ['transcribeAudio'],
      },
    },
    description: 'Public URL or base64 audio data to transcribe',
  },

  // Analyze Image
  {
    displayName: 'Image URL or Base64',
    name: 'imageSource',
    type: 'string',
    default: '',
    placeholder: 'https://example.com/document.jpg or base64 data',
    required: true,
    displayOptions: {
      show: {
        resource: ['mediaAi'],
        operation: ['analyzeImage'],
      },
    },
    description: 'Public URL or base64 image data to inspect',
  },
  {
    displayName: 'Prompt / Query',
    name: 'imagePrompt',
    type: 'string',
    typeOptions: { rows: 3 },
    default: 'Extract all text, line items, and prices from this image.',
    required: true,
    displayOptions: {
      show: {
        resource: ['mediaAi'],
        operation: ['analyzeImage'],
      },
    },
    description: 'Instruction prompt for Gemini Vision AI',
  },
];
