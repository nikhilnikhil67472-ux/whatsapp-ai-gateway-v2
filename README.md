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

All 70 automated tests verify:
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

---

## 🚀 Multi-Platform Deployment Guide

WhatsApp AI Gateway v2 is engineered for 100% plug-and-play multi-platform compatibility across container runtimes and bare-metal environments.

### Target 1: Docker & Docker Compose (Recommended for VPS / Local)

Single command spin-up on any Linux VPS, macOS, or Windows host:

```bash
# 1. Clone repository
git clone https://github.com/nikhilnikhil67472-ux/whatsapp-ai-gateway-v2.git
cd whatsapp-ai-gateway-v2

# 2. Configure environment (optional, sane defaults already provided)
cp .env.example .env

# 3. Spin up container in detached mode
docker compose up -d
```

- **Persistent Storage**: SQLite database, media, and session keys are saved automatically to `./data/` on the host.
- **Port Customization**: By default, the gateway listens on port `800`. To change port, simply set `PORT=3000` or `PORT=8080` in `.env` before running `docker compose up -d`.
- **Health Check**: Automated health checking via `curl -f http://localhost:${PORT}/health`.

---

### Target 2: Render.com (1-Click Blueprint, Docker, or Native Node.js)

Deploy effortlessly on Render with zero configuration errors:

#### Method A: Using `render.yaml` Blueprint (Automated)
1. Fork or push this repository to GitHub.
2. In Render Dashboard, click **New +** -> **Blueprint**.
3. Connect this repository. Render automatically reads `render.yaml`, configures the build, health check (`/health`), dynamic port binding (`PORT`), and persistent storage options.

#### Method B: Manual Docker Web Service (Recommended for zero-dependency ffmpeg)
1. In Render Dashboard, click **New +** -> **Web Service** -> **Build and deploy from a Git repository**.
2. Environment: **Docker**
3. Docker Command: (leave empty, uses Dockerfile)
4. Health Check Path: `/health`
5. Environment Variables:
   - `NODE_ENV`: `production`
   - `UNIFIED_MODE`: `true`
   - `SQLITE_DB_PATH`: `/app/data/gateway.db`
   - `MEDIA_STORAGE_PATH`: `/app/data/media`
   - `ADMIN_API_KEY`: `wag_admin_secret_key_12345` (or your custom secret)

#### Method C: Native Node.js Web Service (Zero Docker)
1. In Render Dashboard, click **New +** -> **Web Service** -> **Build and deploy from a Git repository**.
2. Environment: **Node**
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`
5. Health Check Path: `/health`
6. Environment Variables:
   - `NODE_ENV`: `production`
   - `NODE_VERSION`: `20.18.0` (or >= 20.0.0)
   - `UNIFIED_MODE`: `true`
   - `SQLITE_DB_PATH`: `data/gateway.db`
   - `ADMIN_API_KEY`: `wag_admin_secret_key_12345`

> 💡 **Production Tip for Render**: Render free web services restart when idle and have ephemeral filesystems. For production persistence, upgrade to Render Starter plan ($7/mo) and attach a Persistent Disk (`/app/data`, size: 1GB) so SQLite sessions never reset across restarts.

---

### Target 3: Hugging Face Spaces (Docker Space)

This repository includes native Hugging Face Spaces metadata and UID 1000 compatibility:

1. Create a new Space on [Hugging Face](https://huggingface.co/spaces).
2. Space SDK: **Docker** (Blank)
3. Clone the Space or push this repo directly to your Space repository:
   ```bash
   git remote add space https://huggingface.co/spaces/YOUR_USERNAME/YOUR_SPACE_NAME
   git push space main
   ```
4. **UID 1000 Compliant**: Hugging Face runs containers with non-root user UID 1000. Our Dockerfile leverages Alpine's built-in `node:node` (UID 1000) with permissions pre-configured for `/app/data`.
5. **Port 7860 Compliant**: Dockerfile sets `ENV PORT=7860` and the README frontmatter declares `app_port: 7860` for seamless web interface loading.

---

### Target 4: Railway.app

Deploy with zero configuration via the included `railway.json`:

1. In Railway, click **New Project** -> **Deploy from GitHub repo**.
2. Select `whatsapp-ai-gateway-v2`.
3. Railway automatically detects `railway.json` and builds via `Dockerfile`.
4. Add a Persistent Volume in Railway:
   - Go to service settings -> **Volumes** -> **Add Volume**.
   - Mount path: `/app/data`.
5. Add environment variables:
   - `ADMIN_API_KEY`: your secret key
   - `ENCRYPTION_KEY`: 32-character encryption key
   - (Optional) `GROQ_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`

---

### Target 5: Bare Metal Node.js / Linux VPS / PM2 / systemd

If you prefer running directly on a Linux VPS (Ubuntu / Debian / CentOS), macOS, or Windows without Docker:

#### 1. Prerequisites
- Node.js >= 20.0.0
- Build tools (for better-sqlite3 native compilation):
  - **Ubuntu / Debian**: `sudo apt update && sudo apt install -y build-essential python3 ffmpeg curl`
  - **CentOS / RHEL**: `sudo yum groupinstall "Development Tools" && sudo yum install -y python3 ffmpeg curl`
  - **macOS**: `xcode-select --install && brew install ffmpeg`

#### 2. Install & Compile
```bash
# Clone and enter directory
git clone https://github.com/nikhilnikhil67472-ux/whatsapp-ai-gateway-v2.git
cd whatsapp-ai-gateway-v2

# Copy .env
cp .env.example .env

# Install dependencies (runs postinstall rust bridge patch automatically)
npm install

# Compile TypeScript to dist/
npm run build

# Start production gateway
npm start
```

#### 3. Production Process Management with PM2
To keep the gateway running 24/7 with automatic crash recovery, use the included `ecosystem.config.cjs`:
```bash
# Install PM2 globally
npm install -g pm2

# Start using pre-configured ecosystem (pins single-process fork mode for SQLite & WebSocket safety)
pm2 start ecosystem.config.cjs

# Or start directly with CLI
pm2 start dist/index.js --name "whatsapp-ai-gateway"

# Save PM2 process list and configure system startup
pm2 save
pm2 startup
```

#### 4. Decoupled Architecture (Optional)
If scaling high message volume across multiple CPU cores:
```bash
# Process 1: REST API Server & Dashboard UI
PORT=3000 UNIFIED_MODE=false pm2 start dist/server/index.js --name "wag-web"

# Process 2: Baileys WhatsApp Connection Manager & Outbound Queue Worker
UNIFIED_MODE=false pm2 start dist/worker/index.js --name "wag-worker"
```

---

### Target 6: Fly.io / Koyeb / Zeabur / Coolify / CapRover

All standard container runtimes work directly with the included multi-stage `Dockerfile`:
- **Fly.io** (Blueprint template included in `fly.toml.example`):
  ```bash
  # Copy template
  cp fly.toml.example fly.toml
  # Create persistent volume for SQLite & media
  fly volumes create gateway_data --size 1
  # Deploy container
  fly deploy
  ```
- **Koyeb / Zeabur / Coolify**: Select GitHub repo -> Deploy Dockerfile -> Set persistent volume mount to `/app/data` -> Health check: `/health`.

---

## 🛠️ Multi-Platform Troubleshooting & Production FAQ

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| **`Error: listen EADDRINUSE: address already in use 0.0.0.0:800`** | Port 800 is already occupied by another process on host. | Change `PORT=3000` or `PORT=8080` in `.env` or set environment variable `PORT`. |
| **`Error: listen EACCES: permission denied 0.0.0.0:800`** | Ports < 1024 require root/sudo privileges on Linux. | Use an unprivileged port like `PORT=3000` or `PORT=8080`, or run with sudo. |
| **`SqliteError: unable to open database file` on Docker Linux** | Host volume `./data` was created as `root:root` before container start. | Run `sudo chown -R 1000:1000 ./data` on the host. In our latest repo, `data/.gitkeep` prevents this by pre-creating the directory with current user permissions. |
| **`postinstall` script failed during `npm ci` in Docker** | `scripts/` folder was not copied before running `npm ci`. | Resolved: `Dockerfile` copies `scripts/` before running `npm ci`. |
| **Alpine Linux user creation collision (`adduser -D -u 1000`)** | `node:20-alpine` already includes built-in `node` user with UID 1000. | Resolved: `Dockerfile` leverages built-in `USER node` directly. |
| **WhatsApp disconnected on container restart** | Ephemeral container filesystem lost SQLite database file. | Mount persistent storage for `/app/data` (e.g., `-v ./data:/app/data` in Docker or Persistent Volume in cloud host). |
| **Audio Voice Note (.ogg) conversion fails** | `ffmpeg` is missing on the host system. | In Docker, `ffmpeg` is pre-installed. On bare metal, install via `apt install ffmpeg` or `brew install ffmpeg`. |


