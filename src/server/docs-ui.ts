export function renderDocsHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp AI Gateway v2 - Developer API Reference</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #0b0f19; color: #f1f5f9; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .glass-card { background: rgba(17, 24, 39, 0.75); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.08); }
    .lang-tab.active { background-color: #10b981; color: #022c22; font-weight: 700; }
  </style>
</head>
<body class="min-h-screen flex flex-col">
  <!-- Navbar -->
  <header class="border-b border-gray-800 bg-gray-900/60 sticky top-0 z-50 backdrop-blur-md">
    <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-gray-950 font-bold text-lg">
          <i class="fa-brands fa-whatsapp"></i>
        </div>
        <div>
          <h1 class="text-base font-bold text-white flex items-center gap-2">
            WhatsApp AI Gateway <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">API Docs</span>
          </h1>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <a href="/api-docs?format=json" target="_blank" class="text-xs px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-700 text-gray-300 flex items-center gap-1.5 transition">
          <i class="fa-solid fa-file-code text-teal-400"></i> Raw OpenAPI JSON
        </a>
        <a href="/dashboard" class="text-xs px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-semibold flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/20">
          <i class="fa-solid fa-gauge-high"></i> Dashboard
        </a>
      </div>
    </div>
  </header>

  <!-- Docs Container -->
  <main class="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 space-y-8">
    <!-- Intro Banner -->
    <div class="glass-card rounded-2xl p-6 border border-emerald-500/20 space-y-3">
      <h2 class="text-xl font-extrabold text-white">Developer API Reference & Code Snippets</h2>
      <p class="text-sm text-gray-400 leading-relaxed">
        Integrate WhatsApp messaging, interactive polls, WebP stickers, rich media, voice transcription, group administration, and real-time webhook listeners into your custom SaaS, n8n workflows, Python scripts, or backend services with zero friction.
      </p>
      <div class="flex flex-wrap gap-2 text-xs pt-1">
        <span class="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 flex items-center gap-1.5">
          <i class="fa-solid fa-shield-halved text-emerald-400"></i> Bearer Auth or x-api-key
        </span>
        <span class="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 flex items-center gap-1.5">
          <i class="fa-solid fa-bolt text-amber-400"></i> SQLite Atomic Queue
        </span>
        <span class="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 flex items-center gap-1.5">
          <i class="fa-solid fa-microphone text-teal-400"></i> Whisper Turbo Audio
        </span>
      </div>
    </div>

    <!-- Endpoint 1: Send Interactive Multi-Choice Polls -->
    <section class="glass-card rounded-2xl p-6 space-y-4 border border-blue-500/20">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-3">
        <div class="flex items-center gap-2.5">
          <span class="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-400 font-mono text-xs font-bold border border-blue-500/30">POST</span>
          <h3 class="text-base font-bold text-white font-mono">/api/v1/whatsapp/send-poll</h3>
        </div>
        <span class="text-xs text-gray-400">Send Interactive Multi-Choice Poll</span>
      </div>

      <p class="text-xs text-gray-300">
        Dispatches native interactive WhatsApp Polls. Officially supported across ALL WhatsApp accounts (personal and business) with 100% reliable delivery and instant tap-to-vote capabilities.
      </p>

      <!-- Language Tabs -->
      <div class="space-y-2">
        <div class="flex items-center gap-1.5 p-1 bg-gray-950 rounded-lg border border-gray-800 text-xs font-semibold w-fit">
          <button onclick="switchCodeTab('ep1', 'curl')" id="tab_ep1_curl" class="lang-tab active px-3 py-1 rounded-md transition">cURL</button>
          <button onclick="switchCodeTab('ep1', 'python')" id="tab_ep1_python" class="lang-tab px-3 py-1 rounded-md text-gray-400 hover:text-white transition">Python</button>
          <button onclick="switchCodeTab('ep1', 'nodejs')" id="tab_ep1_nodejs" class="lang-tab px-3 py-1 rounded-md text-gray-400 hover:text-white transition">Node.js</button>
          <button onclick="switchCodeTab('ep1', 'php')" id="tab_ep1_php" class="lang-tab px-3 py-1 rounded-md text-gray-400 hover:text-white transition">PHP</button>
          <button onclick="switchCodeTab('ep1', 'go')" id="tab_ep1_go" class="lang-tab px-3 py-1 rounded-md text-gray-400 hover:text-white transition">Go</button>
        </div>

        <div class="relative">
          <pre id="code_ep1" class="p-4 rounded-xl bg-gray-950 border border-gray-800 text-emerald-300 font-mono text-xs overflow-x-auto leading-relaxed select-all">curl -X POST http://localhost:800/api/v1/whatsapp/send-poll \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "instance_id": "sales-desk",
    "remote_jid": "919876543210@s.whatsapp.net",
    "name": "Which plan would you like to explore?",
    "values": [
      "Starter ($19/mo)",
      "Pro ($49/mo)",
      "Enterprise Suite"
    ],
    "selectable_count": 1
  }'</pre>
        </div>
      </div>
    </section>

    <!-- Endpoint 2: Send Text, Media & Audio Messages -->
    <section class="glass-card rounded-2xl p-6 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-3">
        <div class="flex items-center gap-2.5">
          <span class="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold border border-emerald-500/30">POST</span>
          <h3 class="text-base font-bold text-white font-mono">/api/v1/whatsapp/send</h3>
        </div>
        <span class="text-xs text-gray-400">Send Text, Media URL, Voice Note (PTT), Location, or Contact</span>
      </div>

      <div class="space-y-2">
        <div class="flex items-center gap-1.5 p-1 bg-gray-950 rounded-lg border border-gray-800 text-xs font-semibold w-fit">
          <button onclick="switchCodeTab('ep2', 'curl')" id="tab_ep2_curl" class="lang-tab active px-3 py-1 rounded-md transition">cURL</button>
          <button onclick="switchCodeTab('ep2', 'python')" id="tab_ep2_python" class="lang-tab px-3 py-1 rounded-md text-gray-400 hover:text-white transition">Python</button>
          <button onclick="switchCodeTab('ep2', 'nodejs')" id="tab_ep2_nodejs" class="lang-tab px-3 py-1 rounded-md text-gray-400 hover:text-white transition">Node.js</button>
          <button onclick="switchCodeTab('ep2', 'php')" id="tab_ep2_php" class="lang-tab px-3 py-1 rounded-md text-gray-400 hover:text-white transition">PHP</button>
          <button onclick="switchCodeTab('ep2', 'go')" id="tab_ep2_go" class="lang-tab px-3 py-1 rounded-md text-gray-400 hover:text-white transition">Go</button>
        </div>

        <pre id="code_ep2" class="p-4 rounded-xl bg-gray-950 border border-gray-800 text-emerald-300 font-mono text-xs overflow-x-auto leading-relaxed select-all">curl -X POST http://localhost:800/api/v1/whatsapp/send \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "instance_id": "sales-desk",
    "remote_jid": "919876543210@s.whatsapp.net",
    "type": "text",
    "text": "Hello! Your support ticket #4829 has been resolved."
  }'</pre>
      </div>
    </section>

    <!-- Endpoint 3: 8-Digit Phone Pairing Code -->
    <section class="glass-card rounded-2xl p-6 space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-3">
        <div class="flex items-center gap-2.5">
          <span class="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-400 font-mono text-xs font-bold border border-purple-500/30">POST</span>
          <h3 class="text-base font-bold text-white font-mono">/api/v1/instances/{id}/pairing-code</h3>
        </div>
        <span class="text-xs text-gray-400">Headless Pair via 8-Digit Phone Code (Zero QR scan needed)</span>
      </div>

      <pre class="p-4 rounded-xl bg-gray-950 border border-gray-800 text-teal-300 font-mono text-xs overflow-x-auto select-all">curl -X POST http://localhost:800/api/v1/instances/sales-desk/pairing-code \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "phone_number": "919876543210" }'

# Response:
{
  "success": true,
  "pairing_code": "ABCD-1234",
  "instructions": "Open WhatsApp > Linked Devices > Link with phone number instead"
}</pre>
    </section>

    <!-- Endpoint 4: Granular Events Matrix Config -->
    <section class="glass-card rounded-2xl p-6 space-y-4 border border-amber-500/20">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-3">
        <div class="flex items-center gap-2.5">
          <span class="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 font-mono text-xs font-bold border border-amber-500/30">PATCH</span>
          <h3 class="text-base font-bold text-white font-mono">/api/v1/instances/{id}/events-config</h3>
        </div>
        <span class="text-xs text-gray-400">Granular Event Toggles & Custom Webhook Routing</span>
      </div>

      <pre class="p-4 rounded-xl bg-gray-950 border border-gray-800 text-amber-300 font-mono text-xs overflow-x-auto select-all">curl -X PATCH http://localhost:800/api/v1/instances/sales-desk/events-config \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "events": {
      "messages.upsert": { "enabled": true, "webhook_url": "https://api.yourdomain.com/inbound-messages" },
      "messages.update": { "enabled": true, "webhook_url": null },
      "messages.delete": { "enabled": true, "webhook_url": "https://api.yourdomain.com/deleted-audits" },
      "presence.update": { "enabled": false, "webhook_url": null }
    }
  }'</pre>
    </section>
  </main>

  <script>
    const codeSnippets = {
      ep1: {
        curl: \`curl -X POST http://localhost:800/api/v1/whatsapp/send-poll \\\\
  -H "Authorization: Bearer YOUR_API_KEY" \\\\
  -H "Content-Type: application/json" \\\\
  -d '{
    "instance_id": "sales-desk",
    "remote_jid": "919876543210@s.whatsapp.net",
    "name": "Which plan would you like to explore?",
    "values": [
      "Starter ($19/mo)",
      "Pro ($49/mo)",
      "Enterprise Suite"
    ],
    "selectable_count": 1
  }'\`,
        python: \`import requests

url = "http://localhost:800/api/v1/whatsapp/send-poll"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
payload = {
    "instance_id": "sales-desk",
    "remote_jid": "919876543210@s.whatsapp.net",
    "name": "Which plan would you like to explore?",
    "values": [
        "Starter ($19/mo)",
        "Pro ($49/mo)",
        "Enterprise Suite"
    ],
    "selectable_count": 1
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())\`,
        nodejs: \`const fetch = require('node-fetch');

async function sendPoll() {
  const response = await fetch('http://localhost:800/api/v1/whatsapp/send-poll', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      instance_id: 'sales-desk',
      remote_jid: '919876543210@s.whatsapp.net',
      name: 'Which plan would you like to explore?',
      values: [
        'Starter ($19/mo)',
        'Pro ($49/mo)',
        'Enterprise Suite'
      ],
      selectable_count: 1
    })
  });
  const data = await response.json();
  console.log(data);
}

sendPoll();\`,
        php: \`<?php
$ch = curl_init('http://localhost:800/api/v1/whatsapp/send-poll');
$data = [
    'instance_id' => 'sales-desk',
    'remote_jid' => '919876543210@s.whatsapp.net',
    'name' => 'Which plan would you like to explore?',
    'values' => [
        'Starter ($19/mo)',
        'Pro ($49/mo)',
        'Enterprise Suite'
    ],
    'selectable_count' => 1
];

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer YOUR_API_KEY',
    'Content-Type: application/json'
]);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));

$response = curl_exec($ch);
curl_close($ch);
echo $response;\`,
        go: \`package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

func main() {
    url := "http://localhost:800/api/v1/whatsapp/send-poll"
    payload := map[string]interface{}{
        "instance_id": "sales-desk",
        "remote_jid":  "919876543210@s.whatsapp.net",
        "name":        "Which plan would you like to explore?",
        "values": []string{
            "Starter ($19/mo)",
            "Pro ($49/mo)",
            "Enterprise Suite",
        },
        "selectable_count": 1,
    }
    body, _ := json.Marshal(payload)

    req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
    req.Header.Set("Authorization", "Bearer YOUR_API_KEY")
    req.Header.Set("Content-Type", "application/json")

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()
    fmt.Println("Status:", resp.Status)
}\`
      },
      ep2: {
        curl: \`curl -X POST http://localhost:800/api/v1/whatsapp/send \\\\
  -H "Authorization: Bearer YOUR_API_KEY" \\\\
  -H "Content-Type: application/json" \\\\
  -d '{
    "instance_id": "sales-desk",
    "remote_jid": "919876543210@s.whatsapp.net",
    "type": "text",
    "text": "Hello! Your support ticket #4829 has been resolved."
  }'\`,
        python: \`import requests

url = "http://localhost:800/api/v1/whatsapp/send"
headers = {"Authorization": "Bearer YOUR_API_KEY", "Content-Type": "application/json"}
payload = {
    "instance_id": "sales-desk",
    "remote_jid": "919876543210@s.whatsapp.net",
    "type": "text",
    "text": "Hello! Your support ticket #4829 has been resolved."
}
res = requests.post(url, json=payload, headers=headers)
print(res.json())\`,
        nodejs: \`const fetch = require('node-fetch');

async function sendMsg() {
  const res = await fetch('http://localhost:800/api/v1/whatsapp/send', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer YOUR_API_KEY', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instance_id: 'sales-desk',
      remote_jid: '919876543210@s.whatsapp.net',
      type: 'text',
      text: 'Hello! Your support ticket #4829 has been resolved.'
    })
  });
  console.log(await res.json());
}
sendMsg();\`,
        php: \`<?php
$ch = curl_init('http://localhost:800/api/v1/whatsapp/send');
$data = [
    'instance_id' => 'sales-desk',
    'remote_jid' => '919876543210@s.whatsapp.net',
    'type' => 'text',
    'text' => 'Hello! Your support ticket #4829 has been resolved.'
];
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Bearer YOUR_API_KEY', 'Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
$response = curl_exec($ch);
curl_close($ch);
echo $response;\`,
        go: \`package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

func main() {
    payload := map[string]string{
        "instance_id": "sales-desk",
        "remote_jid":  "919876543210@s.whatsapp.net",
        "type":        "text",
        "text":        "Hello! Your support ticket #4829 has been resolved.",
    }
    body, _ := json.Marshal(payload)
    req, _ := http.NewRequest("POST", "http://localhost:800/api/v1/whatsapp/send", bytes.NewBuffer(body))
    req.Header.Set("Authorization", "Bearer YOUR_API_KEY")
    req.Header.Set("Content-Type", "application/json")
    resp, _ := (&http.Client{}).Do(req)
    defer resp.Body.Close()
    fmt.Println(resp.Status)
}\`
      }
    };

    function switchCodeTab(ep, lang) {
      const langs = ['curl', 'python', 'nodejs', 'php', 'go'];
      langs.forEach(l => {
        const btn = document.getElementById('tab_' + ep + '_' + l);
        if (btn) {
          if (l === lang) {
            btn.className = 'lang-tab active px-3 py-1 rounded-md transition';
          } else {
            btn.className = 'lang-tab px-3 py-1 rounded-md text-gray-400 hover:text-white transition';
          }
        }
      });
      const pre = document.getElementById('code_' + ep);
      if (pre && codeSnippets[ep] && codeSnippets[ep][lang]) {
        pre.innerText = codeSnippets[ep][lang];
      }
    }
  </script>
</body>
</html>`;
}
