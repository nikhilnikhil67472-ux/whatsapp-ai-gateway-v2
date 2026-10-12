# 🚀 WhatsApp AI Gateway v2 — Client & DM Distribution Guide

Use this document whenever a user, client, or developer asks for setup instructions or commands via DM (Instagram, Telegram, WhatsApp, Discord, or Email).

---

## 📋 Option 1: Quick-Copy DM Template (Ready to Send)

Copy and paste the exact text below directly into the DM:

```text
Hey! 👋 Here is your 1-Command Quickstart to run WhatsApp AI Gateway v2 on your PC, Mac, or VPS:

📌 Prerequisites: Only Docker installed (Docker Desktop on Windows/Mac, or Docker on Linux).

────────────────────────────────────────
🚀 1-COMMAND QUICKSTART (Run in Terminal):
────────────────────────────────────────

docker run -d \
  -p 800:7860 \
  -v ./data:/app/data \
  --name whatsapp-ai-gateway \
  --restart always \
  ghcr.io/nikhilnikhil67472-ux/whatsapp-ai-gateway-v2:latest

────────────────────────────────────────
🌐 HOW TO ACCESS:
────────────────────────────────────────
• Localhost: http://localhost:800/dashboard
• On VPS: http://<YOUR_VPS_IP>:800/dashboard
• Master API Key: wag_admin_secret_key_12345

────────────────────────────────────────
⚡ 3-STEP SETUP:
────────────────────────────────────────
1️⃣ Dashboard open karo aur "Create Instance" par click karo.
2️⃣ QR Code scan karo ya "8-Digit Pairing Code" se apna WhatsApp link karo.
3️⃣ "Media AI Studio" tab me jao aur apna Free Groq / OpenAI key connect karo (Zero .env required).

────────────────────────────────────────
🛠️ HELPFUL DOCKER COMMANDS:
────────────────────────────────────────
• View logs: docker logs -f whatsapp-ai-gateway
• Stop gateway: docker stop whatsapp-ai-gateway
• Restart gateway: docker start whatsapp-ai-gateway
• Update to latest: docker pull ghcr.io/nikhilnikhil67472-ux/whatsapp-ai-gateway-v2:latest && docker restart whatsapp-ai-gateway

Let me know if you need any help setting it up! 🙌
```

---

## 📄 Option 2: Docker Compose Quickstart (`docker-compose.yml`)

If the user prefers `docker compose`, ask them to save this into a `docker-compose.yml` file and run `docker compose up -d`:

```yaml
version: '3.8'

services:
  whatsapp-gateway:
    image: ghcr.io/nikhilnikhil67472-ux/whatsapp-ai-gateway-v2:latest
    container_name: whatsapp-ai-gateway
    restart: always
    ports:
      - "800:7860"
    volumes:
      - ./data:/app/data
    environment:
      - PORT=7860
      - HOST=0.0.0.0
      - UNIFIED_MODE=true
      - SQLITE_DB_PATH=/app/data/gateway.db
      - MEDIA_STORAGE_PATH=/app/data/media
      - ADMIN_API_KEY=wag_admin_secret_key_12345
    healthcheck:
      test: ["CMD", "sh", "-c", "curl -f http://localhost:7860/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
```

Run command:
```bash
docker compose up -d
```

Dashboard Access:
👉 `http://localhost:800/dashboard`

---

## ☁️ Option 3: Deploy on Render.com (Pre-Built Image, Zero Code)

If a user wants to run it on Render.com for free without cloning the repo:

1. Go to **Render.com** -> Click **New +** -> **Web Service**.
2. Select **"Deploy an existing image"**.
3. Paste Image URL:
   ```text
   ghcr.io/nikhilnikhil67472-ux/whatsapp-ai-gateway-v2:latest
   ```
4. Set Port: `7860`.
5. Click **Deploy Web Service**.

---

## 🚂 Option 4: Deploy on Railway.app (Pre-Built Image, Zero Code)

1. Go to **Railway.app** -> Click **New Project**.
2. Choose **"Deploy a Docker Image"**.
3. Paste Image URL:
   ```text
   ghcr.io/nikhilnikhil67472-ux/whatsapp-ai-gateway-v2:latest
   ```
4. Railway will automatically pull and start the container.

---

## 🔒 Security & Intellectual Property Notes
- The image `ghcr.io/nikhilnikhil67472-ux/whatsapp-ai-gateway-v2:latest` contains **only compiled production artifacts**.
- The raw TypeScript source code (`src/` folder), development tests, and configuration tooling are **never distributed** inside the image.
- Database and WhatsApp session credentials are stored inside the user's mounted `./data` directory so their sessions persist across container restarts.
