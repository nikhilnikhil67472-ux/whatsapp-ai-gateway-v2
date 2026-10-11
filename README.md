---
title: WhatsApp AI Gateway v2
emoji: ⚡
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# WhatsApp AI Gateway v2

> High-Profile, Autonomous WhatsApp Web AI Gateway & Engine connecting Baileys v7 with **OpenAI**, **Anthropic Claude**, **n8n**, **Groq Whisper Turbo**, and Granular Custom Webhooks. Built for developers with single-command Docker deployment.

---

## ⚡ 1-Command Quick Start (Docker)

Spin up the entire gateway stack in 1 command without configuring Node.js or installing build toolchains:

```bash
docker compose up -d
```

Open your browser to access the production dashboard:
👉 **[http://localhost:800/dashboard](http://localhost:800/dashboard)**

API Documentation & Multi-Language Code Playground:
👉 **[http://localhost:800/api-docs/ui](http://localhost:800/api-docs/ui)**

---

## ✨ Enterprise & Developer Features

### 1. 🔗 Connection & Pairing
- **Dual Connection Modes**:
  - **Camera QR Code**: Instant scan via WhatsApp Linked Devices.
  - **8-Digit Pairing Code**: Headless phone pairing without requiring a camera scan (ideal for remote servers & VPS).
- **Anti-Reconnect-Loop State Machine**: Distinguishes transient network drops from logged-out sessions with exponential backoff.
- **Zero-File-Leak SQLite Session Store**: Signal protocol keys and credentials are encrypted at rest with **AES-256-GCM** inside SQLite with WAL mode.

### 2. ⚡ Granular Events & Webhooks Matrix
- **Dedicated Trigger Management**: Enable or disable specific WhatsApp events individually per instance:
  - `messages.upsert` — Incoming messages, media, voice notes, stickers
  - `messages.update` — Delivery receipts, message read acknowledgments
  - `messages.delete` — Revoked / deleted messages
  - `presence.update` — Typing indicators, recording, online/offline status
  - `groups.update` — Participant joins, promotions, subject updates
  - `connection.update` — Session lifecycle (connecting, paired, closed, qr refreshed)
- **Custom Webhook URL Overrides**: Route individual event types to separate microservice endpoints or n8n webhooks.
- **Live Pipeline Monitor & Inspector**: Real-time traffic monitor showing delivery status (200 OK, Retrying, Failed), delivery latency (ms), and payload inspection with 1-click retry.

### 3. 🎙️ Media & Voice AI Studio
- **Ultra-Fast Voice Note Transcription**: Converts inbound audio voice notes (.ogg opus PTT) to text in ~250ms using **Groq Whisper Turbo** (`whisper-large-v3-turbo`) with automatic fallback to **OpenAI Whisper**.
- **Automatic Inbound Media Pipeline**: Decrypts incoming photos, videos, voice notes, and PDF documents, storing them under `/media/` and passing accessible public URLs to webhooks and AI models.

### 4. 💬 Production Messaging Primitives & Interactive Sandbox
- **Interactive Multi-Choice Polls**: Native WhatsApp polls with configurable selectable counts—100% reliable across all Meta WhatsApp accounts without account drops.
- **WebP Stickers with Custom EXIF**: Deliver branded stickers with custom pack name and author metadata.
- **Rich Media & Push-To-Talk (PTT)**: Send images, videos, documents, and voice notes with simulated recording presence.
- **Live Visual Mockup Sandbox**: Interactive tester in the dashboard with real-time WhatsApp bubble previews for text, media, stickers, and polls.

### 5. 🛡️ Anti-Ban Safeguards
- **SIM Anti-Ban Warm-up Engine**: Gradually ramps outbound message capacity for newly connected numbers (Day 1: 30 msgs, Day 2: 60 msgs, Day 3: 120 msgs, Day 4: 250 msgs, Day 5+: 500 msgs/day) to prevent WhatsApp anti-spam bans.
- **SOCKS5 / HTTP Proxy Support**: Route WhatsApp socket connections through rotating residential or datacenter proxies per instance to eliminate IP-level restrictions.
- **Dynamic Presence Simulation**: Simulates human keystroke delays (`composing` and `recording`) with randomized jitter before sending.
- **Auto-Call Rejection & Group Ignore**: Automatically reject incoming voice/video calls and ignore group chatter.

### 6. 🌐 Developer DX & n8n Ecosystem (2 Integration Options)
- **Multi-Tenant Authentication**: Scoped API keys (`x-api-key: wag_...`) and JWT tokens.
- **Interactive API Docs**: Copy-paste snippets in **cURL**, **Python**, **Node.js**, **PHP**, and **Go** at `/api-docs/ui`.
- **Option A — Native n8n Community Node (`n8n-nodes-whatsapp-ai-gateway`)**:
  - Full drag-and-drop community node package in `packages/n8n-nodes-whatsapp-ai-gateway/`.
  - Includes credentials (`WhatsApp AI Gateway API`), action node (`WhatsApp AI Gateway`), and trigger node (`WhatsApp AI Gateway Trigger`).
  - Supports sending text, media, interactive polls, WebP stickers, group administration, Whisper audio transcription, and receiving incoming WhatsApp events.
- **Option B — Ready-to-Import Workflow Template (`templates/n8n-whatsapp-ai-agent.json`)**:
  - 1-click importable JSON workflow for developers who want zero node installation.
  - Plugs into LangChain / OpenAI / Claude to run an autonomous customer service agent out of the box.

---

## 🛠️ REST API Quick Reference

### Send Interactive Poll (100% Native Delivery)
```bash
curl -X POST http://localhost:800/api/v1/whatsapp/send-poll \
  -H "Authorization: Bearer wag_admin_secret_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "instance_id": "sales-desk",
    "remote_jid": "919876543210@s.whatsapp.net",
    "name": "Please select your plan:",
    "values": ["Starter Plan ($29/mo)", "Pro Plan ($99/mo)", "Enterprise Custom"],
    "selectable_count": 1
  }'
```

### Request 8-Digit Pairing Code
```bash
curl -X POST http://localhost:800/api/v1/instances/sales-desk/pairing-code \
  -H "Authorization: Bearer wag_admin_secret_key_12345" \
  -H "Content-Type: application/json" \
  -d '{ "phone_number": "919876543210" }'
```

### Configure Granular Events Matrix
```bash
curl -X PATCH http://localhost:800/api/v1/instances/sales-desk/events-config \
  -H "Authorization: Bearer wag_admin_secret_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "events": {
      "messages.upsert": { "enabled": true, "webhook_url": "https://api.yourdomain.com/inbound" },
      "messages.delete": { "enabled": true, "webhook_url": "https://api.yourdomain.com/audits" },
      "group-participants.update": { "enabled": true, "webhook_url": "https://api.yourdomain.com/groups" }
    }
  }'
```

### Send WebP Sticker with Custom EXIF Metadata
```bash
curl -X POST http://localhost:800/api/v1/whatsapp/send-sticker \
  -H "Authorization: Bearer wag_admin_secret_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "instance_id": "sales-desk",
    "remote_jid": "919876543210@s.whatsapp.net",
    "sticker_url": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png",
    "pack_name": "My Custom Bot",
    "author_name": "Antigravity"
  }'
```

### Send Interactive Multi-Choice Poll
```bash
curl -X POST http://localhost:800/api/v1/whatsapp/send-poll \
  -H "Authorization: Bearer wag_admin_secret_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "instance_id": "sales-desk",
    "remote_jid": "919876543210@s.whatsapp.net",
    "name": "Which feature would you like next?",
    "values": ["CRM Integration", "Custom AI Voice Notes", "Automated Billing"],
    "selectable_count": 1
  }'
```

### Create and Manage WhatsApp Groups
```bash
# Create Group
curl -X POST http://localhost:800/api/v1/whatsapp/groups \
  -H "Authorization: Bearer wag_admin_secret_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "instance_id": "sales-desk",
    "subject": "VIP Client Community",
    "participants": ["919876543210", "919876543211"]
  }'

# Get Group Invite Code & Link
curl -X GET "http://localhost:800/api/v1/whatsapp/groups/120363000000000000@g.us/invite-code?instance_id=sales-desk" \
  -H "Authorization: Bearer wag_admin_secret_key_12345"
```

### Real-Time Server-Sent Events (SSE) Stream
Listen to incoming WhatsApp messages and status events in real-time without configuring public webhook tunnels (ngrok):
```bash
curl -N -H "Authorization: Bearer wag_admin_secret_key_12345" \
  http://localhost:800/api/v1/instances/sales-desk/events/stream
```

### Model Context Protocol (MCP) for AI Agents
Connect Claude Desktop, Cursor, Windsurf, or custom AI agents directly to WhatsApp using the standard MCP Streamable HTTP interface:
```json
{
  "mcpServers": {
    "whatsapp-ai-gateway": {
      "url": "http://localhost:800/api/v1/mcp",
      "headers": {
        "x-api-key": "wag_admin_secret_key_12345"
      }
    }
  }
}
```

---

## 🧪 Testing & Verification

Run the full end-to-end automated test suite:

```bash
npm test
```

All 50 test suites verify:
- REST API Auth, Master Key, and Scoped API keys
- AES-256-GCM Encryption and HMAC-SHA256 Webhook signatures
- Multi-Tenant Workspace Isolation
- Baileys Proxy Resolution & Keystroke Presence Simulation
- SIM Anti-Ban Warm-up Ramp Limits
- Voice AI Audio Transcription Handler
- 8-Digit Pairing Code API Validation
- Webhook Delivery Retries, Atomic SQLite Claiming, and Live Inspection
- Inbound Message Normalization, Ephemeral Unwrapping, and Polls
- WebP EXIF Sticker Pipeline & Interactive Polls
- Complete WhatsApp Group Administration Suite
- Server-Sent Events (SSE) Real-Time Live Stream
- Model Context Protocol (MCP) JSON-RPC 2.0 tool execution
- n8n Community Node 6-Resource Ecosystem (`n8n-nodes-whatsapp-ai-gateway`)

