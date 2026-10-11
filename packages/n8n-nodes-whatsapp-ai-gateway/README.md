# n8n-nodes-whatsapp-ai-gateway

Official **Evolution-API-Grade n8n Community Node** for [WhatsApp AI Gateway v2](https://github.com/nikhil/whatsapp-ai-gateway-v2).

Connect WhatsApp Web directly to **n8n AI Agents, LangChain, OpenAI, Claude, Supabase, and Postgres** with zero per-message Twilio fees and zero Meta Cloud API template restrictions.

---

## ⚡ Feature Comparison (Evolution API Parity)

| Feature | Evolution API Node | WhatsApp AI Gateway Node |
|---|:---:|:---:|
| **Send Text & Markdown** | ✅ | ✅ |
| **Quoted / Reply-To Message** | ✅ | ✅ |
| **Send Media (Image/Video/Doc)** | ✅ | ✅ |
| **Send Voice Note (PTT Simulation)** | ✅ | ✅ |
| **Interactive Multi-Choice Polls** | ✅ | ✅ |
| **WebP Stickers (Custom EXIF)** | ✅ | ✅ |
| **Group Administration (10 Ops)** | ✅ | ✅ |
| **Send GPS Location & Contact vCard** | ✅ | ✅ |
| **Send Emoji Reactions** | ✅ | ✅ |
| **Check Number on WhatsApp (`onWhatsApp`)**| ✅ | ✅ |
| **Real-time Connection Status & QR** | ✅ | ✅ |
| **8-Digit Headless Phone Pairing** | ❌ (QR only in most) | ✅ (Full headless pairing) |
| **Presence (Typing / Recording)** | ✅ | ✅ |
| **Inbound Webhook Trigger Node** | ✅ | ✅ |
| **Filter Outbound Echoes (`fromMe`)** | ✅ | ✅ |
| **Filter Group Chatter** | ✅ | ✅ |
| **Native Voice AI Transcription (Whisper)**| ❌ (Needs extra nodes)| ✅ (Built-in `/media/transcribe`) |
| **Native Vision AI Inspection (Gemini)** | ❌ (Needs extra nodes)| ✅ (Built-in `/media/analyze`) |
| **SIM Anti-Ban Warm-Up Limits** | ❌ (Manual scripts) | ✅ (Built-in Gateway Engine) |

---

## 📦 Installation in n8n

### Option 1: Via n8n Community Nodes UI (Recommended)
1. Open n8n, navigate to **Settings > Community Nodes**.
2. Click **Install a community node**.
3. Enter `n8n-nodes-whatsapp-ai-gateway` and accept the community node terms.
4. Click **Install**. Both **WhatsApp AI Gateway** and **WhatsApp AI Gateway Trigger** will appear in your node search!

### Option 2: Via Docker / Self-Hosted n8n CLI
Mount or install directly in your n8n volume:
```bash
cd ~/.n8n/custom/
npm install n8n-nodes-whatsapp-ai-gateway
```

---

## 🔑 Credentials Setup

1. In n8n, add credential: **WhatsApp AI Gateway API**.
2. Provide:
   - **Gateway Base URL**: `http://localhost:800` (or `https://gateway.yourdomain.com`).
   - **API Key**: `wag_...` (from Gateway Dashboard `http://localhost:800/dashboard` or `.env`).
3. Click **Save & Test Connection**. It automatically pings the `/health` endpoint to verify status.

---

## 🚀 Nodes & Resources

### 1. WhatsApp AI Gateway (Action Node)

#### 💬 Resource: `Message`
- `Send Text Message`: With WhatsApp markdown (`*bold*`, `_italic_`, `~strike~`, `` `code` ``) & quoted replies.
- `Send Media`: Deliver images, videos (including round Push-To-Video notes), documents, or audio files via public URL or raw Base64.
- `Send Audio / Voice Note`: Native PTT voice notes with green WhatsApp microphone indicator and simulated recording presence.
- `Send Interactive Poll`: Multi-choice native WhatsApp poll with customizable voter choice limits.
- `Send Sticker`: WebP sticker with automated EXIF injection for custom sticker pack name and author.
- `Send Location`: GPS latitude, longitude, location name, and street address.
- `Send Contact`: vCard contact cards.
- `Send Emoji Reaction`: Attach emoji reaction (`👍`, `❤️`, `🔥`, `😂`) to any WhatsApp message ID.
- `Edit Message`: Edit already sent text messages within the WhatsApp allowed window.
- `Delete Message`: Revoke/delete sent messages for everyone.

#### 👥 Resource: `Group`
- `Create Group`: Create new WhatsApp groups with participants.
- `Get Group Metadata`: Fetch member roster, group admins, and group subject.
- `Update Group Subject & Description`: Change group title and topic description.
- `Manage Participants`: Add, remove, promote, or demote participants.
- `Invite Codes`: Fetch or revoke/rotate group join invite links.
- `Join & Leave Group`: Join via invite link or gracefully leave group.
- `Group Settings`: Configure announcement-only or locked settings.

#### 📱 Resource: `Instance`
- `Get Status & QR Code`: Real-time status (`paired`, `connecting`, `disconnected`) and QR code base64.
- `Request Pairing Code`: 8-digit code for linking phone without camera QR scanning.
- `Set Presence Status`: `composing`, `recording`, `available`, `unavailable`, `paused`.
- `Create Instance`: Provision new WhatsApp number / instance with proxy and webhook.
- `List Instances`: Enumerate all registered instances in your workspace.
- `Start / Restart / Stop / Logout / Delete`: Full lifecycle instance management.

#### 🔎 Resource: `Chat`
- `Check Number Exists on WhatsApp`: Instant validation whether a phone number is registered on WhatsApp before sending outbound campaigns.
- `List Conversations`: Active conversations and recent dialogue history.
- `List Messages`: Message history for compliance audits or CRM sync.

#### ⚡ Resource: `Webhook & Events`
- `Get Events Trigger Matrix`: Check which WhatsApp events are enabled for an instance.
- `Update Events Configuration`: Assign custom webhooks per event (`messages.upsert`, `messages.update`, `presence.update`, etc.).
- `Send Test Webhook Ping`: Immediate diagnostic ping to test connectivity.
- `List Webhook Deliveries`: Inspect HTTP status codes, latency, and error logs.

#### 🎙️ Resource: `Voice & Media AI`
- `Transcribe Audio / Voice Note`: Built-in Whisper Turbo transcription for inbound customer voice notes.
- `Analyze Image`: Gemini Vision OCR and multimodal query inspection.

---

### 2. WhatsApp AI Gateway Trigger (Webhook Node)

Starts workflows immediately when events occur on WhatsApp:
- **Event Filter**: Filter by `messages.upsert`, `messages.update`, `messages.reaction`, `connection.update`, `presence.update`.
- **Instance Filter**: Route specific numbers to dedicated workflows.
- **Ignore Outbound**: Discards your own messages sent from your physical phone (`fromMe: true`).
- **Ignore Groups**: Prevents group chats from firing support workflows.
- **Only Media Messages**: Triggers only when a customer sends a photo, voice note, or invoice document.

#### Output Payload:
```json
{
  "event": "messages.upsert",
  "instanceId": "support-line",
  "senderJid": "919876543210@s.whatsapp.net",
  "senderPhone": "+919876543210",
  "senderName": "Customer Name",
  "userMessage": "Where is my delivery?",
  "messageType": "text",
  "mediaUrl": null,
  "messageId": "3EB0ABC123456",
  "fromMe": false,
  "isGroup": false,
  "timestamp": 1728562300000
}
```

---

## 🤖 1-Click AI Agent Workflow Template

For instant zero-installation use in n8n Cloud or self-hosted n8n:
- Open n8n ➔ **Import Workflow** ➔ Choose [templates/n8n-whatsapp-ai-agent.json](file:///C:/Users/nikhi/.gemini/antigravity/scratch/whatsapp-ai-gateway-v2/templates/n8n-whatsapp-ai-agent.json).
- Includes LangChain autonomous support agent with memory, OpenAI/Claude reasoning, and automated WhatsApp replies!

---

## 📄 License
MIT © WhatsApp AI Gateway Team
