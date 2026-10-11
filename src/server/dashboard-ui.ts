export function renderDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp AI Gateway v2 - High-Profile Production Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #0b0f19; color: #f1f5f9; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .glass-card { background: rgba(17, 24, 39, 0.75); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.08); }
    .glow-green { box-shadow: 0 0 15px rgba(34, 197, 94, 0.2); }
    .glow-amber { box-shadow: 0 0 15px rgba(245, 158, 11, 0.2); }
    .glow-blue { box-shadow: 0 0 15px rgba(59, 130, 246, 0.2); }
    .instance-tab-btn.active { background-color: rgba(31, 41, 55, 0.9); color: #34d399; border-color: rgba(52, 211, 153, 0.3); }
    .toggle-checkbox:checked { right: 0; border-color: #10b981; }
    .toggle-checkbox:checked + .toggle-label { background-color: #10b981; }
  </style>
</head>
<body class="min-h-screen flex flex-col">
  <!-- Navbar -->
  <header class="border-b border-gray-800 bg-gray-900/60 sticky top-0 z-50 backdrop-blur-md">
    <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-gray-950 font-bold text-xl shadow-lg shadow-emerald-500/20">
          <i class="fa-brands fa-whatsapp"></i>
        </div>
        <div>
          <h1 class="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            WhatsApp AI Gateway <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">v2.0</span>
          </h1>
          <p class="text-xs text-gray-400">Autonomous WhatsApp &bull; OpenAI &bull; Anthropic &bull; n8n &bull; Whisper Voice AI</p>
        </div>
      </div>
      <div class="flex items-center gap-2.5">
        <div id="navOrgPill" class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/80 border border-gray-700/60 text-xs text-gray-300">
          <i class="fa-solid fa-briefcase text-emerald-400"></i>
          <span id="navWorkspaceName" class="font-medium text-white">Default Workspace</span>
          <span id="navPlanTier" class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold uppercase border border-emerald-500/30">ENTERPRISE</span>
        </div>
        <button onclick="openApiKeysModal()" class="text-xs px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-700 transition flex items-center gap-1.5 text-gray-300">
          <i class="fa-solid fa-key text-amber-400"></i> API Keys
        </button>
        <a href="/api-docs" target="_blank" class="text-xs px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-700 transition flex items-center gap-2 text-gray-300">
          <i class="fa-solid fa-code"></i> API Docs
        </a>
        <button onclick="openCreateModal()" class="text-xs px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-semibold transition flex items-center gap-2 shadow-lg shadow-emerald-500/20">
          <i class="fa-solid fa-plus"></i> New Instance
        </button>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
    <!-- Left Sidebar: Instances List -->
    <div class="lg:col-span-4 space-y-4">
      <div class="flex items-center justify-between px-1">
        <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-400">Instances</h2>
        <span id="instanceCount" class="text-xs px-2 py-0.5 rounded-md bg-gray-800 text-gray-300">0</span>
      </div>
      <div id="instancesList" class="space-y-3">
        <!-- Rendered via JS -->
      </div>
    </div>

    <!-- Right Area: Details & Actions -->
    <div class="lg:col-span-8 space-y-6">
      <div id="noInstanceSelected" class="glass-card rounded-2xl p-12 text-center text-gray-500">
        <i class="fa-solid fa-qrcode text-4xl mb-3 text-gray-600"></i>
        <p class="text-base font-medium">Select or create an instance to manage WhatsApp connections and Webhooks.</p>
      </div>

      <div id="instanceDetails" class="hidden space-y-6">
        <!-- Top Instance Header & Controls -->
        <div class="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-3">
                <h3 id="currentInstanceName" class="text-xl font-bold text-white"></h3>
                <span id="currentStatusBadge" class="text-xs font-semibold px-2.5 py-1 rounded-full border"></span>
              </div>
              <p id="currentInstanceMeta" class="text-xs text-gray-400 mt-1"></p>
            </div>
            <!-- Quick Actions -->
            <div class="flex flex-wrap gap-2">
              <button onclick="triggerInstanceAction('start')" class="text-xs px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600/40 text-emerald-300 font-medium transition">
                <i class="fa-solid fa-play"></i> Start
              </button>
              <button onclick="triggerInstanceAction('restart')" class="text-xs px-3 py-1.5 rounded-lg bg-amber-600/20 border border-amber-500/30 hover:bg-amber-600/40 text-amber-300 font-medium transition">
                <i class="fa-solid fa-rotate-right"></i> Restart
              </button>
              <button onclick="triggerInstanceAction('stop')" class="text-xs px-3 py-1.5 rounded-lg bg-gray-700/40 border border-gray-600 hover:bg-gray-700 text-gray-300 font-medium transition">
                <i class="fa-solid fa-stop"></i> Stop
              </button>
              <button onclick="triggerInstanceAction('logout')" class="text-xs px-3 py-1.5 rounded-lg bg-orange-600/20 border border-orange-500/30 hover:bg-orange-600/40 text-orange-300 font-medium transition">
                <i class="fa-solid fa-right-from-bracket"></i> Logout
              </button>
              <button onclick="triggerInstanceAction('delete')" class="text-xs px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-700/50 hover:bg-red-800/50 text-red-300 font-medium transition">
                <i class="fa-solid fa-trash"></i> Delete
              </button>
            </div>
          </div>
        </div>

        <!-- High-Profile 5-Tab Sub-Navigation -->
        <div class="flex items-center gap-2 p-1.5 bg-gray-900/90 rounded-2xl border border-gray-800 overflow-x-auto text-xs font-semibold">
          <button id="navTabConnection" onclick="switchInstanceTab('connection')" class="instance-tab-btn active px-3.5 py-2 rounded-xl flex items-center gap-2 transition text-emerald-400 bg-gray-800 border border-emerald-500/30 shrink-0">
            <i class="fa-solid fa-link"></i> Connection & Pairing
          </button>
          <button id="navTabEvents" onclick="switchInstanceTab('events')" class="instance-tab-btn px-3.5 py-2 rounded-xl flex items-center gap-2 transition text-gray-400 hover:text-white shrink-0">
            <i class="fa-solid fa-bolt text-amber-400"></i> Events & Webhooks Matrix
          </button>
          <button id="navTabMediaVoice" onclick="switchInstanceTab('mediaVoice')" class="instance-tab-btn px-3.5 py-2 rounded-xl flex items-center gap-2 transition text-gray-400 hover:text-white shrink-0">
            <i class="fa-solid fa-microphone text-teal-400"></i> Media & Voice Studio
          </button>
          <button id="navTabChatsSandbox" onclick="switchInstanceTab('chatsSandbox')" class="instance-tab-btn px-3.5 py-2 rounded-xl flex items-center gap-2 transition text-gray-400 hover:text-white shrink-0">
            <i class="fa-solid fa-comments text-blue-400"></i> Chats & Sandbox
          </button>
          <button id="navTabSettings" onclick="switchInstanceTab('settings')" class="instance-tab-btn px-3.5 py-2 rounded-xl flex items-center gap-2 transition text-gray-400 hover:text-white shrink-0">
            <i class="fa-solid fa-shield-halved text-purple-400"></i> Settings & Anti-Ban
          </button>
        </div>

        <!-- ========================================================================= -->
        <!-- TAB 1: CONNECTION & PAIRING -->
        <!-- ========================================================================= -->
        <div id="panelConnection" class="tab-panel space-y-6">
          <div class="glass-card rounded-2xl p-6 space-y-5">
            <div class="flex items-center justify-between border-b border-gray-800 pb-3">
              <div>
                <h4 class="text-sm font-bold text-white flex items-center gap-2">
                  <i class="fa-solid fa-link text-emerald-400"></i> WhatsApp Authentication
                </h4>
                <p class="text-xs text-gray-400 mt-0.5">Link WhatsApp using Camera QR Code or 8-digit Phone Pairing Code (no camera needed).</p>
              </div>
              <div class="flex items-center gap-2">
                <button id="tabQrBtn" onclick="switchPairingTab('qr')" class="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 flex items-center gap-1.5 transition">
                  <i class="fa-solid fa-qrcode"></i> QR Code Scan
                </button>
                <button id="tabPairingBtn" onclick="switchPairingTab('pairing')" class="text-xs px-3 py-1.5 rounded-lg bg-gray-900 text-gray-400 hover:text-white font-medium border border-gray-800 flex items-center gap-1.5 transition">
                  <i class="fa-solid fa-mobile-screen-button"></i> 8-Digit Pairing Code
                </button>
              </div>
            </div>

            <!-- View A: QR Code View -->
            <div id="viewQrTab" class="flex flex-col md:flex-row items-center gap-6">
              <div id="qrContainer" class="w-48 h-48 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center p-2 relative shadow-inner shrink-0">
                <div id="qrLoading" class="text-center text-xs text-gray-500">
                  <i class="fa-solid fa-spinner fa-spin text-2xl text-emerald-400 mb-2"></i>
                  <p>Generating QR Code...</p>
                </div>
                <img id="qrImage" class="w-full h-full object-contain hidden rounded-lg" alt="WhatsApp QR Code" />
                <div id="connectedBadge" class="hidden text-center text-emerald-400">
                  <i class="fa-solid fa-circle-check text-4xl mb-2"></i>
                  <p class="font-semibold text-sm">WhatsApp Paired!</p>
                </div>
              </div>
              <div class="space-y-3 flex-1 text-sm text-gray-300">
                <h5 class="font-semibold text-white flex items-center gap-2">
                  <i class="fa-solid fa-camera text-emerald-400"></i> Scan to Link WhatsApp Web
                </h5>
                <ol class="list-decimal list-inside space-y-1.5 text-xs text-gray-400">
                  <li>Open WhatsApp on your mobile phone</li>
                  <li>Tap <strong>Settings</strong> &gt; <strong>Linked Devices</strong></li>
                  <li>Tap <strong>Link a Device</strong> and point your camera at this QR code</li>
                  <li>Real-time chat messages forward automatically to your configured Webhooks & AI workflows!</li>
                </ol>
              </div>
            </div>

            <!-- View B: 8-Digit Pairing Code View -->
            <div id="viewPairingTab" class="hidden flex flex-col md:flex-row items-start gap-6 p-4 rounded-xl bg-gray-900/60 border border-gray-800">
              <div class="space-y-3 flex-1 text-xs">
                <div>
                  <label class="block text-gray-300 font-semibold mb-1">WhatsApp Phone Number (with Country Code)</label>
                  <div class="flex items-center gap-2">
                    <input id="pairingPhoneNumber" type="text" placeholder="e.g. 919876543210 (no + or spaces)" class="flex-1 px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white font-mono text-xs focus:outline-none focus:border-emerald-500" />
                    <button id="btnRequestPairingCode" onclick="requestPairingCode()" class="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 shrink-0">
                      <i class="fa-solid fa-key"></i> Get Code
                    </button>
                  </div>
                  <span class="text-[10px] text-gray-500 mt-1 block">Enter the phone number registered on your target WhatsApp device</span>
                </div>

                <div id="pairingCodeResult" class="hidden p-4 rounded-xl bg-gray-950 border border-emerald-500/40 text-center space-y-2.5">
                  <div class="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Your 8-Digit Pairing Code</div>
                  <div class="text-3xl font-mono font-extrabold text-white tracking-[0.25em] select-all py-1 bg-black/40 rounded-lg border border-gray-800" id="pairingCodeBox">---- ----</div>
                  <div class="flex items-center justify-center gap-2">
                    <button onclick="copyPairingCode()" class="text-xs px-3.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition flex items-center gap-1.5">
                      <i class="fa-solid fa-copy"></i> Copy Code
                    </button>
                    <span id="copyPairingNotice" class="text-[11px] text-emerald-400 font-medium hidden">Copied!</span>
                  </div>
                </div>

                <div id="pairingCodeError" class="hidden p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs"></div>
              </div>

              <div class="space-y-2.5 text-xs text-gray-400 max-w-xs shrink-0">
                <h5 class="font-bold text-white text-xs flex items-center gap-1.5">
                  <i class="fa-solid fa-circle-info text-teal-400"></i> How to pair via phone code:
                </h5>
                <ol class="list-decimal list-inside space-y-1 text-[11px] text-gray-300">
                  <li>Open WhatsApp on your mobile phone</li>
                  <li>Go to <strong>Settings</strong> &gt; <strong>Linked Devices</strong></li>
                  <li>Tap <strong>Link a Device</strong></li>
                  <li>Tap <strong>Link with phone number instead</strong> at the bottom</li>
                  <li>Type this 8-digit code onto your phone to link instantly!</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        <!-- ========================================================================= -->
        <!-- TAB 2: EVENTS & WEBHOOKS MATRIX -->
        <!-- ========================================================================= -->
        <div id="panelEvents" class="tab-panel space-y-6 hidden">
          <!-- Live Visual Pipeline -->
          <div id="pipelineContainer" class="glass-card rounded-2xl p-5 border border-emerald-500/20 space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-2.5">
              <div class="flex items-center gap-2">
                <span id="pipelineLiveDot" class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span class="text-xs font-bold text-white uppercase tracking-wider">Live Pipeline Traffic Monitor</span>
                <span id="pipelineOverallBadge" class="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Active</span>
              </div>
              <div id="pipelineBannerText" class="text-xs text-gray-300 font-medium">Listening for inbound messages...</div>
              <span id="pipelineLastUpdate" class="text-[10px] text-gray-500">Checking...</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <!-- Step 1: WhatsApp Inbound -->
              <div class="p-3.5 rounded-xl bg-gray-950/70 border border-gray-800 flex items-start gap-3">
                <div class="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg shrink-0 mt-0.5">
                  <i class="fa-brands fa-whatsapp"></i>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-bold text-white flex items-center justify-between">
                    <span>1. WhatsApp Chat</span>
                    <span id="pipelineWaBadge" class="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-gray-800 text-gray-400">Idle</span>
                  </div>
                  <p id="pipelineWaText" class="text-[11px] text-gray-300 mt-1 break-words line-clamp-2">Waiting for incoming messages</p>
                  <p id="pipelineWaTime" class="text-[10px] text-emerald-400/80 mt-1">No data received yet</p>
                </div>
              </div>

              <!-- Step 2: Gateway Normalization & Filter -->
              <div class="p-3.5 rounded-xl bg-gray-950/70 border border-gray-800 flex items-start gap-3">
                <div class="w-10 h-10 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center text-lg shrink-0 mt-0.5">
                  <i class="fa-solid fa-filter"></i>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-bold text-white flex items-center justify-between">
                    <span>2. Gateway Filter</span>
                    <span class="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-teal-500/20 text-teal-400">Protected</span>
                  </div>
                  <p class="text-[11px] text-gray-400 mt-1">Phone notifications, newsletters, LIDs & broadcasts filtered</p>
                  <p class="text-[10px] text-teal-400/80 mt-1">Only verified user chats pass</p>
                </div>
              </div>

              <!-- Step 3: Target Webhook Delivery -->
              <div class="p-3.5 rounded-xl bg-gray-950/70 border border-gray-800 flex items-start gap-3">
                <div id="pipelineWhIcon" class="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-lg shrink-0 mt-0.5">
                  <i class="fa-solid fa-satellite-dish"></i>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-bold text-white flex items-center justify-between">
                    <span>3. Target Webhook</span>
                    <span id="pipelineWhBadge" class="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-gray-800 text-gray-400">Not Set</span>
                  </div>
                  <p id="pipelineWhText" class="text-[11px] text-gray-300 mt-1 truncate font-mono text-[10px]" title="Target Webhook URL">No webhook configured</p>
                  <p id="pipelineWhStatus" class="text-[10px] text-gray-400 mt-1">Save Webhook URL below</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Webhook KPI Stats -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
              <div class="text-[10px] uppercase font-semibold text-gray-400">Total Dispatches</div>
              <div id="statTotal" class="text-xl font-bold text-white mt-0.5">0</div>
            </div>
            <div class="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
              <div class="text-[10px] uppercase font-semibold text-emerald-400">Delivered (200 OK)</div>
              <div id="statDelivered" class="text-xl font-bold text-emerald-400 mt-0.5">0</div>
            </div>
            <div class="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
              <div class="text-[10px] uppercase font-semibold text-rose-400">Failed / Retrying</div>
              <div id="statFailed" class="text-xl font-bold text-rose-400 mt-0.5">0</div>
            </div>
            <div class="p-3 rounded-xl bg-gray-900/60 border border-gray-800">
              <div class="text-[10px] uppercase font-semibold text-teal-400">Average Latency</div>
              <div id="statLatency" class="text-xl font-bold text-teal-400 mt-0.5">0 ms</div>
            </div>
          </div>

          <!-- GRANULAR EVENTS TRIGGER MATRIX SECTION -->
          <div class="glass-card rounded-2xl p-6 space-y-4 border border-amber-500/20">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
              <div>
                <h4 class="text-sm font-bold text-white flex items-center gap-2">
                  <i class="fa-solid fa-network-wired text-amber-400"></i> Granular Events Trigger Matrix & URL Overrides
                </h4>
                <p class="text-xs text-gray-400 mt-0.5">Configure individual event dispatches. Leave URL blank to use default webhook, or specify an event-specific URL.</p>
              </div>
              <button onclick="saveEventsConfig()" class="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-xs transition flex items-center gap-1.5 shadow-lg shadow-amber-500/20">
                <i class="fa-solid fa-floppy-disk"></i> Save Events Matrix
              </button>
            </div>

            <div class="space-y-3 text-xs">
              <!-- Event 1: messages.upsert -->
              <div class="p-3 rounded-xl bg-gray-900/80 border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <input id="evtToggle_messages_upsert" type="checkbox" class="w-4 h-4 accent-emerald-500 cursor-pointer" checked />
                    <span class="font-bold text-white font-mono">messages.upsert</span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">Core Inbound</span>
                  </div>
                  <p class="text-gray-400 text-[11px] mt-1">Triggers when new messages, images, audio/voice notes, or attachments arrive from users.</p>
                </div>
                <div class="md:w-80">
                  <input id="evtUrl_messages_upsert" type="text" placeholder="Custom Webhook URL (leave empty for default)" class="w-full px-2.5 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-white font-mono text-[11px] focus:outline-none focus:border-amber-500" />
                </div>
              </div>

              <!-- Event 2: messages.update -->
              <div class="p-3 rounded-xl bg-gray-900/80 border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <input id="evtToggle_messages_update" type="checkbox" class="w-4 h-4 accent-emerald-500 cursor-pointer" checked />
                    <span class="font-bold text-white font-mono">messages.update</span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold">Receipts & Status</span>
                  </div>
                  <p class="text-gray-400 text-[11px] mt-1">Triggers on delivery receipts, message read acknowledgments, and reaction updates.</p>
                </div>
                <div class="md:w-80">
                  <input id="evtUrl_messages_update" type="text" placeholder="Custom Webhook URL (leave empty for default)" class="w-full px-2.5 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-white font-mono text-[11px] focus:outline-none focus:border-amber-500" />
                </div>
              </div>

              <!-- Event 3: messages.delete -->
              <div class="p-3 rounded-xl bg-gray-900/80 border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <input id="evtToggle_messages_delete" type="checkbox" class="w-4 h-4 accent-emerald-500 cursor-pointer" />
                    <span class="font-bold text-white font-mono">messages.delete</span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-semibold">Revocations</span>
                  </div>
                  <p class="text-gray-400 text-[11px] mt-1">Triggers when a message is deleted for everyone by the sender.</p>
                </div>
                <div class="md:w-80">
                  <input id="evtUrl_messages_delete" type="text" placeholder="Custom Webhook URL (leave empty for default)" class="w-full px-2.5 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-white font-mono text-[11px] focus:outline-none focus:border-amber-500" />
                </div>
              </div>

              <!-- Event 4: presence.update -->
              <div class="p-3 rounded-xl bg-gray-900/80 border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <input id="evtToggle_presence_update" type="checkbox" class="w-4 h-4 accent-emerald-500 cursor-pointer" />
                    <span class="font-bold text-white font-mono">presence.update</span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-semibold">User Activity</span>
                  </div>
                  <p class="text-gray-400 text-[11px] mt-1">Triggers when contact starts typing (composing), recording audio, or goes online/offline.</p>
                </div>
                <div class="md:w-80">
                  <input id="evtUrl_presence_update" type="text" placeholder="Custom Webhook URL (leave empty for default)" class="w-full px-2.5 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-white font-mono text-[11px] focus:outline-none focus:border-amber-500" />
                </div>
              </div>

              <!-- Event 5: groups.update -->
              <div class="p-3 rounded-xl bg-gray-900/80 border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <input id="evtToggle_groups_update" type="checkbox" class="w-4 h-4 accent-emerald-500 cursor-pointer" />
                    <span class="font-bold text-white font-mono">groups.update</span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-400 font-semibold">Group Admin</span>
                  </div>
                  <p class="text-gray-400 text-[11px] mt-1">Triggers when group subject/icon changes, or participants join/leave/promoted.</p>
                </div>
                <div class="md:w-80">
                  <input id="evtUrl_groups_update" type="text" placeholder="Custom Webhook URL (leave empty for default)" class="w-full px-2.5 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-white font-mono text-[11px] focus:outline-none focus:border-amber-500" />
                </div>
              </div>

              <!-- Event 6: connection.update -->
              <div class="p-3 rounded-xl bg-gray-900/80 border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <input id="evtToggle_connection_update" type="checkbox" class="w-4 h-4 accent-emerald-500 cursor-pointer" checked />
                    <span class="font-bold text-white font-mono">connection.update</span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold">Lifecycle</span>
                  </div>
                  <p class="text-gray-400 text-[11px] mt-1">Triggers on WhatsApp connection changes: connecting, open, closed, or QR generated.</p>
                </div>
                <div class="md:w-80">
                  <input id="evtUrl_connection_update" type="text" placeholder="Custom Webhook URL (leave empty for default)" class="w-full px-2.5 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-white font-mono text-[11px] focus:outline-none focus:border-amber-500" />
                </div>
              </div>
            </div>
            <div id="eventsSaveStatus" class="text-xs font-medium text-center min-h-[16px]"></div>
          </div>

          <!-- Webhook Endpoints & Security Card -->
          <div class="glass-card rounded-2xl p-6 space-y-4">
            <div class="flex items-center justify-between border-b border-gray-800 pb-3">
              <div>
                <h4 class="text-sm font-bold text-white flex items-center gap-2">
                  <i class="fa-solid fa-satellite-dish text-emerald-400"></i> Default Webhook Endpoints & Security
                </h4>
                <p class="text-xs text-gray-400 mt-0.5">Primary destinations for un-routed WhatsApp chat events & n8n automation flows.</p>
              </div>
              <div class="flex items-center gap-2">
                <button onclick="testWebhook('primary')" class="text-xs px-3 py-1.5 rounded-lg bg-teal-500/20 border border-teal-500/40 hover:bg-teal-500/30 text-teal-300 font-semibold transition flex items-center gap-1.5">
                  <i class="fa-solid fa-vial"></i> Test Primary
                </button>
                <button onclick="testWebhook('n8n')" class="text-xs px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 hover:bg-indigo-500/30 text-indigo-300 font-semibold transition flex items-center gap-1.5">
                  <i class="fa-solid fa-vial"></i> Test n8n
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label class="block text-gray-400 mb-1 font-medium">Primary Webhook URL (HTTP POST)</label>
                <input id="settingWebhookUrl" type="text" onblur="formatUrlInput('settingWebhookUrl')" placeholder="https://your-domain.com/api/webhook" class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-emerald-500 font-mono text-[11px]" />
                <span class="text-[10px] text-gray-500 mt-0.5 block">Receives verified chat events, sender metadata & media URLs</span>
              </div>
              <div>
                <label class="block text-gray-400 mb-1 font-medium">n8n Automation Webhook URL (Optional)</label>
                <input id="settingN8nWebhookUrl" type="text" onblur="formatUrlInput('settingN8nWebhookUrl')" placeholder="https://n8n.your-domain.com/webhook/..." class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-emerald-500 font-mono text-[11px]" />
                <span class="text-[10px] text-gray-500 mt-0.5 block">Trigger n8n workflow on inbound messages & send back auto-replies</span>
              </div>
              <div>
                <label class="block text-gray-400 mb-1 font-medium">Webhook HMAC Secret (Optional)</label>
                <input id="settingWebhookSecret" type="text" placeholder="whsec_xxxxxxxxxx" class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-emerald-500 font-mono text-[11px]" />
                <span class="text-[10px] text-gray-500 mt-0.5 block">Signs payloads via sha256 in x-hub-signature-256 header</span>
              </div>
              <div class="flex items-end">
                <button onclick="saveWebhookSettings()" class="w-full py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10">
                  <i class="fa-solid fa-floppy-disk"></i> Save Webhook Settings
                </button>
              </div>
            </div>
            <div id="webhookSaveStatus" class="text-xs font-medium text-center min-h-[16px]"></div>
          </div>

          <!-- Live Delivery Log Stream & Inspector -->
          <div class="glass-card rounded-2xl p-6 space-y-3">
            <div class="flex items-center justify-between border-b border-gray-800 pb-3">
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-white">Live Delivery Stream & Payload Inspector</span>
                <span id="deliveryCountBadge" class="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 font-semibold">0</span>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <select id="deliveryFilter" onchange="renderDeliveries()" class="px-2 py-1 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 focus:outline-none">
                  <option value="all">All Events</option>
                  <option value="delivered">Delivered (200 OK)</option>
                  <option value="failed">Failed / Retrying</option>
                </select>
                <button onclick="clearDeliveryHistory()" class="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition">
                  <i class="fa-solid fa-trash-can"></i> Clear
                </button>
                <button onclick="loadWebhookDeliveries()" class="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition">
                  <i class="fa-solid fa-arrows-rotate"></i> Refresh
                </button>
              </div>
            </div>
            <div id="webhookDeliveriesList" class="space-y-2 max-h-80 overflow-y-auto pr-1">
              <!-- Rendered via JS -->
            </div>
          </div>
        </div>

        <!-- ========================================================================= -->
        <!-- TAB 3: MEDIA & VOICE AI STUDIO -->
        <!-- ========================================================================= -->
        <div id="panelMediaVoice" class="tab-panel space-y-6 hidden">
          <!-- Voice Note Transcription Card -->
          <div class="glass-card rounded-2xl p-6 space-y-5 border border-teal-500/20">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
              <div>
                <h4 class="text-sm font-bold text-white flex items-center gap-2">
                  <i class="fa-solid fa-microphone-lines text-teal-400"></i> Voice AI Audio Transcription Engine
                </h4>
                <p class="text-xs text-gray-400 mt-0.5">Converts WhatsApp audio voice notes (PTT) to text in ~250ms and injects transcript directly into Webhooks & AI pipeline.</p>
              </div>
              <span class="text-xs px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 font-semibold flex items-center gap-1.5">
                <i class="fa-solid fa-bolt"></i> Auto-Transcription Active
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div class="p-4 rounded-xl bg-gray-900/70 border border-gray-800 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-white flex items-center gap-1.5">
                    <i class="fa-solid fa-gauge-high text-teal-400"></i> Groq Whisper Turbo
                  </span>
                  <span class="text-[10px] px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold uppercase">Primary (~250ms)</span>
                </div>
                <p class="text-gray-400 text-[11px]">Hardware-accelerated Whisper-large-v3-turbo engine. Ideal for live conversational WhatsApp chatbots where latency matters.</p>
                <div class="text-[10px] text-gray-500 font-mono">Config: Set GROQ_API_KEY in .env</div>
              </div>

              <div class="p-4 rounded-xl bg-gray-900/70 border border-gray-800 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-white flex items-center gap-1.5">
                    <i class="fa-solid fa-brain text-purple-400"></i> OpenAI Whisper
                  </span>
                  <span class="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold uppercase">Fallback (~1200ms)</span>
                </div>
                <p class="text-gray-400 text-[11px]">Official OpenAI Whisper-1 audio API. Automatically used as a resilient fallback if Groq is unavailable.</p>
                <div class="text-[10px] text-gray-500 font-mono">Config: Set OPENAI_API_KEY in .env</div>
              </div>
            </div>

            <!-- How Voice AI Works Flow -->
            <div class="p-4 rounded-xl bg-gray-950/70 border border-gray-800 space-y-3">
              <span class="font-bold text-white text-xs block">End-to-End Voice Note Lifecycle</span>
              <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px] text-gray-400">
                <div class="p-2.5 rounded-lg bg-gray-900 border border-gray-800">
                  <div class="font-semibold text-teal-300 mb-0.5">1. WhatsApp PTT</div>
                  <span>Inbound voice note (.ogg opus) decrypted by Baileys.</span>
                </div>
                <div class="p-2.5 rounded-lg bg-gray-900 border border-gray-800">
                  <div class="font-semibold text-teal-300 mb-0.5">2. Transcribe</div>
                  <span>Fast Groq/OpenAI speech-to-text turns voice into words.</span>
                </div>
                <div class="p-2.5 rounded-lg bg-gray-900 border border-gray-800">
                  <div class="font-semibold text-teal-300 mb-0.5">3. Webhook Delivery</div>
                  <span>Webhook receives both raw audio URL & transcribed text.</span>
                </div>
                <div class="p-2.5 rounded-lg bg-gray-900 border border-gray-800">
                  <div class="font-semibold text-teal-300 mb-0.5">4. AI Response</div>
                  <span>AI Agent replies directly to the customer's voice query.</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Media Extraction & Inbound Storage Card -->
          <div class="glass-card rounded-2xl p-6 space-y-4">
            <h4 class="text-sm font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
              <i class="fa-solid fa-photo-film text-emerald-400"></i> Media Extraction & Pass-through Pipeline
            </h4>
            <p class="text-xs text-gray-400">Incoming images, videos, audio clips, and PDF documents are automatically decrypted, stored locally under <code class="bg-gray-800 px-1 py-0.5 rounded font-mono text-emerald-400">/media/</code>, and delivered as accessible URLs directly to your webhook payloads.</p>
            
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div class="p-3 rounded-xl bg-gray-900/60 border border-gray-800 text-center">
                <i class="fa-solid fa-image text-emerald-400 text-xl mb-1"></i>
                <div class="font-bold text-white">Images</div>
                <div class="text-[10px] text-gray-500">JPG, PNG, WebP</div>
              </div>
              <div class="p-3 rounded-xl bg-gray-900/60 border border-gray-800 text-center">
                <i class="fa-solid fa-video text-blue-400 text-xl mb-1"></i>
                <div class="font-bold text-white">Videos</div>
                <div class="text-[10px] text-gray-500">MP4, 3GP, MOV</div>
              </div>
              <div class="p-3 rounded-xl bg-gray-900/60 border border-gray-800 text-center">
                <i class="fa-solid fa-file-pdf text-rose-400 text-xl mb-1"></i>
                <div class="font-bold text-white">Documents</div>
                <div class="text-[10px] text-gray-500">PDF, DOCX, ZIP</div>
              </div>
              <div class="p-3 rounded-xl bg-gray-900/60 border border-gray-800 text-center">
                <i class="fa-solid fa-microphone text-teal-400 text-xl mb-1"></i>
                <div class="font-bold text-white">Audio Notes</div>
                <div class="text-[10px] text-gray-500">OGG Opus (PTT)</div>
              </div>
            </div>
          </div>
        </div>

        <!-- ========================================================================= -->
        <!-- TAB 4: CHATS & INTERACTIVE SANDBOX -->
        <!-- ========================================================================= -->
        <div id="panelChatsSandbox" class="tab-panel space-y-6 hidden">
          <!-- Interactive Messaging Sandbox with Real-Time Mockup Preview -->
          <div class="glass-card rounded-2xl p-6 space-y-5 border border-blue-500/20">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
              <div>
                <h4 class="text-sm font-bold text-white flex items-center gap-2">
                  <i class="fa-solid fa-wand-magic-sparkles text-blue-400"></i> Production Messaging Sandbox & Mockup Tester
                </h4>
                <p class="text-xs text-gray-400 mt-0.5">Send regular Text, Media (Images/Video/PTV), WebP Stickers, or Interactive Polls directly to any WhatsApp number.</p>
              </div>
              <!-- Sandbox Mode Switcher -->
              <div class="flex items-center gap-1.5 p-1 bg-gray-950 rounded-lg border border-gray-800 text-xs">
                <button id="sbModeText" onclick="switchSandboxMode('text')" class="px-2.5 py-1 rounded bg-blue-600/30 text-blue-300 font-bold border border-blue-500/30">Text</button>
                <button id="sbModeMedia" onclick="switchSandboxMode('media')" class="px-2.5 py-1 rounded text-gray-400 hover:text-white">Media</button>
                <button id="sbModeSticker" onclick="switchSandboxMode('sticker')" class="px-2.5 py-1 rounded text-gray-400 hover:text-white">Sticker</button>
                <button id="sbModePoll" onclick="switchSandboxMode('poll')" class="px-2.5 py-1 rounded text-gray-400 hover:text-white">Interactive Poll</button>
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <!-- Left: Sandbox Input Form -->
              <div class="lg:col-span-7 space-y-3 text-xs">
                <div>
                  <label class="block text-gray-400 mb-1 font-medium">Recipient Phone (Country Code + Number)</label>
                  <input id="sbRecipient" type="text" placeholder="e.g. 919876543210" class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-white font-mono text-xs focus:outline-none focus:border-blue-500" />
                </div>

                <!-- Form Mode 1: Regular Text -->
                <div id="sbFormText" class="space-y-3">
                  <div>
                    <label class="block text-gray-400 mb-1 font-medium">Message Body</label>
                    <textarea id="sbTextBody" oninput="updateSandboxMockup()" rows="3" placeholder="Hello! Welcome to our automated WhatsApp service." class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-blue-500"></textarea>
                  </div>
                </div>

                <!-- Form Mode 2: Media -->
                <div id="sbFormMedia" class="space-y-3 hidden">
                  <div>
                    <label class="block text-gray-400 mb-1 font-medium">Media Public URL or Local Path</label>
                    <input id="sbMediaUrl" oninput="updateSandboxMockup()" type="text" placeholder="https://example.com/banner.jpg" class="w-full px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-white text-xs font-mono" />
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="block text-gray-400 mb-1">Media Type</label>
                      <select id="sbMediaType" onchange="updateSandboxMockup()" class="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-white text-xs">
                        <option value="image">Image (JPEG/PNG/WebP)</option>
                        <option value="video">Video (MP4)</option>
                        <option value="document">Document (PDF/DOC)</option>
                        <option value="audio">Audio / Voice Note (PTT)</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-gray-400 mb-1">Caption / Note (Optional)</label>
                      <input id="sbMediaCaption" oninput="updateSandboxMockup()" type="text" placeholder="Check out our brochure!" class="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-white text-xs" />
                    </div>
                  </div>
                  <div class="flex items-center gap-2 pt-1">
                    <input id="sbMediaPtv" type="checkbox" onchange="updateSandboxMockup()" class="w-4 h-4 accent-emerald-500 cursor-pointer" />
                    <label for="sbMediaPtv" class="text-xs text-gray-300 cursor-pointer">Round PTV Video Note (Round selfie camera bubble)</label>
                  </div>
                </div>

                <!-- Form Mode 3: Sticker -->
                <div id="sbFormSticker" class="space-y-3 hidden">
                  <div>
                    <label class="block text-gray-400 mb-1 font-medium">Sticker Image or WebP URL</label>
                    <input id="sbStickerUrl" oninput="updateSandboxMockup()" type="text" placeholder="https://example.com/sticker.webp" class="w-full px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-white text-xs font-mono" />
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="block text-gray-400 mb-1">Sticker Pack Name</label>
                      <input id="sbStickerPack" oninput="updateSandboxMockup()" type="text" value="WhatsApp AI Gateway" placeholder="Pack Name" class="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-white text-xs" />
                    </div>
                    <div>
                      <label class="block text-gray-400 mb-1">Author Name</label>
                      <input id="sbStickerAuthor" oninput="updateSandboxMockup()" type="text" value="Antigravity" placeholder="Author Name" class="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-white text-xs" />
                    </div>
                  </div>
                  <p class="text-[11px] text-gray-500">Auto-injects genuine WhatsApp WebP EXIF metadata so stickers show custom pack details in recipient's sticker tray.</p>
                </div>

                <!-- Form Mode 4: Interactive Poll -->
                <div id="sbFormPoll" class="space-y-3 hidden">
                  <div>
                    <label class="block text-gray-400 mb-1 font-medium">Poll Question / Title</label>
                    <input id="sbPollName" oninput="updateSandboxMockup()" type="text" placeholder="Which service are you interested in?" value="Which feature should we build next?" class="w-full px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-white text-xs" />
                  </div>
                  <div class="space-y-2">
                    <label class="block text-gray-400 text-[11px] font-semibold">Answer Choices (Minimum 2):</label>
                    <input id="sbPollOpt1" oninput="updateSandboxMockup()" type="text" value="AI Voice Calls & Transcription" placeholder="Option 1" class="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-white text-xs" />
                    <input id="sbPollOpt2" oninput="updateSandboxMockup()" type="text" value="Automated CRM Follow-ups" placeholder="Option 2" class="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-white text-xs" />
                    <input id="sbPollOpt3" oninput="updateSandboxMockup()" type="text" value="Multi-Agent Orchestration" placeholder="Option 3 (Optional)" class="w-full px-2.5 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-white text-xs" />
                  </div>
                  <div class="flex items-center justify-between pt-1">
                    <label class="text-gray-400 text-xs font-medium">Allow Multiple Choice Selection?</label>
                    <select id="sbPollSelectable" onchange="updateSandboxMockup()" class="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 text-white text-xs">
                      <option value="1">Single Choice (1 vote)</option>
                      <option value="2">Multiple Choice (up to 2)</option>
                      <option value="3">Multiple Choice (all options)</option>
                    </select>
                  </div>
                  <div class="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-[11px] text-emerald-300">
                    <i class="fa-solid fa-circle-check"></i> <strong>100% Reliable:</strong> WhatsApp Polls are officially supported by Meta on all mobile & desktop clients without restriction.
                  </div>
                </div>

                <button onclick="dispatchSandboxMessage()" class="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
                  <i class="fa-solid fa-paper-plane"></i> Dispatch Message to WhatsApp
                </button>
                <div id="sbSendStatus" class="text-center font-medium min-h-[16px]"></div>
              </div>

              <!-- Right: Live WhatsApp Mockup Preview Card -->
              <div class="lg:col-span-5 flex flex-col items-center justify-center p-4 rounded-xl bg-gray-950/90 border border-gray-800 shadow-inner">
                <span class="text-[10px] text-gray-400 uppercase font-semibold mb-3 flex items-center gap-1.5">
                  <i class="fa-brands fa-whatsapp text-emerald-400"></i> WhatsApp Mockup Preview
                </span>
                <div class="w-full max-w-[280px] rounded-2xl bg-[#0b141a] p-3 border border-emerald-900/30 text-xs shadow-xl space-y-2">
                  <!-- Text & Media Preview Bubble -->
                  <div id="mockupMsgCard" class="rounded-xl bg-[#005c4b] text-white p-3 space-y-2 shadow">
                    <div id="mockupBody" class="text-[12px] whitespace-pre-wrap leading-relaxed">Hello! Welcome to our automated WhatsApp service.</div>
                    <div id="mockupMediaBox" class="hidden rounded-lg overflow-hidden border border-emerald-700/50 bg-[#023328] p-2 text-center text-emerald-200">
                      <i class="fa-solid fa-photo-film text-xl mb-1"></i>
                      <div id="mockupMediaText" class="text-[11px] font-mono truncate">[Media Attachment]</div>
                    </div>
                  </div>
                  <!-- Sticker Preview Bubble -->
                  <div id="mockupStickerCard" class="hidden rounded-xl bg-[#0b141a] p-2 text-center space-y-1">
                    <div class="w-24 h-24 mx-auto rounded-xl bg-[#202c33] flex items-center justify-center text-4xl shadow-inner border border-gray-700">
                      🤖
                    </div>
                    <div id="mockupStickerMeta" class="text-[10px] text-gray-400">Pack: WhatsApp AI Gateway &bull; Antigravity</div>
                  </div>
                  <!-- Poll Preview Bubble -->
                  <div id="mockupPollCard" class="hidden rounded-xl bg-[#005c4b] text-white p-3 space-y-2 shadow border border-emerald-600/40">
                    <div id="mockupPollQuestion" class="font-bold text-[13px] text-white">Which feature should we build next?</div>
                    <div id="mockupPollSubtitle" class="text-[10px] text-emerald-200/80">Select one</div>
                    <div id="mockupPollOptions" class="space-y-1.5 pt-1">
                      <!-- generated via updateSandboxMockup -->
                    </div>
                    <div class="pt-2 border-t border-emerald-600/40 text-center">
                      <span class="text-[11px] font-semibold text-emerald-200 hover:text-white cursor-pointer"><i class="fa-solid fa-square-check"></i> Vote</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Live Conversation Feed (Filtered Real Chat Messages Only) -->
          <div class="glass-card rounded-2xl p-6 space-y-4">
            <div class="flex items-center justify-between border-b border-gray-800 pb-3">
              <div>
                <h4 class="text-sm font-semibold text-white flex items-center gap-2">
                  <i class="fa-solid fa-comments text-emerald-400"></i> Conversation Feed (Real Chat Messages)
                </h4>
                <p class="text-[11px] text-gray-400">System stubs, phone notifications, and broadcasts are filtered automatically</p>
              </div>
              <button onclick="loadMessages()" class="text-xs px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition">
                <i class="fa-solid fa-rotate-right"></i> Refresh Feed
              </button>
            </div>
            <div id="messagesStream" class="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              <!-- Rendered via JS -->
            </div>
          </div>
        </div>

        <!-- ========================================================================= -->
        <!-- TAB 5: SETTINGS & ANTI-BAN -->
        <!-- ========================================================================= -->
        <div id="panelSettings" class="tab-panel space-y-6 hidden">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Anti-Ban & Proxy Protection Card -->
            <div class="glass-card rounded-2xl p-6 space-y-4 border border-purple-500/20">
              <h4 class="text-sm font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
                <i class="fa-solid fa-shield-halved text-purple-400"></i> Anti-Ban Safeguards & Proxy
              </h4>
              <div class="space-y-3 text-xs">
                <div>
                  <label class="block text-gray-400 mb-1 font-medium">Proxy URL (SOCKS5 / HTTP Proxy)</label>
                  <input id="settingProxyUrl" type="text" placeholder="socks5://user:pass@host:port or http://host:port" class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-purple-500 font-mono text-[11px]" />
                  <span class="text-[10px] text-gray-500 mt-0.5 block">Routes WhatsApp connection to prevent IP-level rate limits and geo-restrictions</span>
                </div>

                <!-- SIM Warm-up Schedule Engine -->
                <div class="p-3.5 rounded-xl bg-gray-950/80 border border-emerald-500/30 space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-white flex items-center gap-1.5">
                      <i class="fa-solid fa-temperature-arrow-up text-emerald-400"></i> SIM Anti-Ban Warm-up Engine
                    </span>
                    <span id="settingWarmupBadge" class="font-mono text-emerald-400 font-semibold text-[11px]">Day 1 &bull; 0/30 msgs</span>
                  </div>
                  <p class="text-[11px] text-gray-400 leading-relaxed">
                    Automatically protects new numbers by enforcing gradual outbound limits: Day 1: 30 &bull; Day 2: 60 &bull; Day 3: 120 &bull; Day 4: 250 &bull; Day 5+: 500 msgs/day.
                  </p>
                </div>

                <div>
                  <label class="block text-gray-400 mb-1 font-medium">Outbound Throttle (Max msgs / minute)</label>
                  <input id="settingOutboundPerMin" type="number" min="1" max="300" class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-purple-500" />
                  <span class="text-[10px] text-gray-500 mt-0.5 block">Dynamic keystroke jitter delay is automatically applied before each message</span>
                </div>

                <div class="grid grid-cols-2 gap-2 pt-1">
                  <label class="flex items-center gap-2 text-gray-300 cursor-pointer">
                    <input id="settingRejectCalls" type="checkbox" class="w-3.5 h-3.5 accent-emerald-500" />
                    <span>Auto-Reject Calls</span>
                  </label>
                  <label class="flex items-center gap-2 text-gray-300 cursor-pointer">
                    <input id="settingIgnoreGroups" type="checkbox" class="w-3.5 h-3.5 accent-emerald-500" />
                    <span>Ignore Groups</span>
                  </label>
                  <label class="flex items-center gap-2 text-gray-300 cursor-pointer">
                    <input id="settingSandboxMode" type="checkbox" class="w-3.5 h-3.5 accent-emerald-500" />
                    <span>Sandbox Mode</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- AI Engine & Parameters Card -->
            <div class="glass-card rounded-2xl p-6 space-y-4">
              <h4 class="text-sm font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
                <i class="fa-solid fa-robot text-teal-400"></i> AI Auto-Reply Engine
              </h4>
              <div class="space-y-3 text-xs">
                <div class="flex items-center justify-between py-1">
                  <span class="text-gray-300 font-semibold">Enable Autonomous AI Auto-Reply</span>
                  <input id="settingAiEnabled" type="checkbox" class="w-4 h-4 accent-emerald-500" />
                </div>
                <div>
                  <label class="block text-gray-400 mb-1 font-medium">AI Provider</label>
                  <select id="settingAiProvider" class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-teal-500">
                    <option value="openai">OpenAI (ChatGPT)</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="n8n">n8n Automation Webhook</option>
                    <option value="webhook">Custom Webhook</option>
                  </select>
                </div>
                <div>
                  <label class="block text-gray-400 mb-1 font-medium">Model Name (Optional)</label>
                  <input id="settingAiModel" type="text" placeholder="e.g. gpt-4o-mini or claude-3-5-sonnet" class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label class="block text-gray-400 mb-1 font-medium">System Instructions / Prompt</label>
                  <textarea id="settingAiSystemPrompt" rows="3" placeholder="You are a helpful customer support representative..." class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-teal-500"></textarea>
                </div>

                <button onclick="saveInstanceSettings()" class="w-full py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-bold border border-gray-700 transition mt-2">
                  <i class="fa-solid fa-floppy-disk mr-1"></i> Save Instance Settings
                </button>
                <div id="instanceSaveStatus" class="text-xs font-medium text-center min-h-[16px]"></div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </main>

  <!-- Create Instance Modal -->
  <div id="createModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center hidden p-4">
    <div class="glass-card rounded-2xl p-6 max-w-md w-full space-y-4 border border-gray-700">
      <div class="flex items-center justify-between border-b border-gray-800 pb-3">
        <h3 class="font-bold text-white text-base">Initialize New WhatsApp Instance</h3>
        <button onclick="closeCreateModal()" class="text-gray-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="space-y-3 text-xs">
        <div>
          <label class="block text-gray-400 mb-1">Instance Name (Unique Slug)</label>
          <input id="newInstanceName" type="text" placeholder="e.g. sales-desk or support-bot" class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-emerald-500" />
        </div>
        <div>
          <label class="block text-gray-400 mb-1">AI Provider</label>
          <select id="newAiProvider" class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-emerald-500">
            <option value="openai">OpenAI (ChatGPT)</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="n8n">n8n Automation Flow</option>
            <option value="webhook">Custom Webhook</option>
          </select>
        </div>
        <div>
          <label class="block text-gray-400 mb-1">Primary Webhook URL (Optional)</label>
          <input id="newWebhookUrl" type="text" placeholder="https://your-domain.com/webhook" class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-emerald-500" />
        </div>
        <div>
          <label class="block text-gray-400 mb-1">n8n Webhook URL (Optional)</label>
          <input id="newN8nWebhookUrl" type="text" placeholder="https://n8n.domain.com/webhook/..." class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-emerald-500" />
        </div>
        <div>
          <label class="block text-gray-400 mb-1">Proxy URL (Optional)</label>
          <input id="newProxyUrl" type="text" placeholder="socks5://user:pass@host:port" class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-white focus:outline-none focus:border-emerald-500 font-mono text-[11px]" />
        </div>
        <div class="flex items-center gap-2 pt-1">
          <input id="newSandboxMode" type="checkbox" class="w-4 h-4 accent-emerald-500" />
          <label for="newSandboxMode" class="text-gray-300">Sandbox Mode (Bypass SIM rate limits for testing)</label>
        </div>
        <div id="createErrorMsg" class="hidden text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-lg break-words"></div>
        <button id="btnCreateSubmit" onclick="submitCreateInstance()" class="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold transition mt-4">
          Create & Initialize
        </button>
      </div>
    </div>
  </div>

  <!-- API Keys Management Modal -->
  <div id="apiKeysModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center hidden p-4">
    <div class="glass-card rounded-2xl p-6 max-w-lg w-full space-y-4 border border-gray-700">
      <div class="flex items-center justify-between border-b border-gray-800 pb-3">
        <h3 class="font-bold text-white text-base flex items-center gap-2">
          <i class="fa-solid fa-key text-amber-400"></i> Workspace API Keys
        </h3>
        <button onclick="closeApiKeysModal()" class="text-gray-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="space-y-3 text-xs">
        <p class="text-gray-400">Use these API keys with header <code class="bg-gray-800 px-1.5 py-0.5 rounded text-emerald-400 font-mono">x-api-key: wag_...</code> to authenticate automated REST API calls from n8n, Zapier, cURL, or your SaaS platform.</p>
        
        <div class="flex items-center justify-between pt-1">
          <span class="font-semibold text-white">Active Keys</span>
          <button onclick="generateNewApiKey()" class="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-xs transition flex items-center gap-1 shadow-lg shadow-emerald-500/10">
            <i class="fa-solid fa-plus"></i> New API Key
          </button>
        </div>

        <div id="apiKeysList" class="space-y-2 max-h-56 overflow-y-auto pr-1">
          <!-- Rendered via JS -->
        </div>

        <div id="newKeyAlert" class="hidden p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
          <span class="text-amber-400 font-bold block text-xs"><i class="fa-solid fa-triangle-exclamation"></i> Copy New API Key Now</span>
          <div class="flex items-center gap-2">
            <input id="newKeyValueDisplay" readonly type="text" class="flex-1 px-2.5 py-1.5 rounded bg-black/60 border border-gray-800 font-mono text-emerald-300 text-xs select-all" />
            <button onclick="copyGeneratedApiKey()" class="px-3 py-1.5 rounded bg-emerald-500 text-gray-950 font-bold text-xs hover:bg-emerald-400 transition">Copy</button>
          </div>
          <span class="text-[10px] text-gray-400 block">For security, full key secret is displayed once only.</span>
        </div>
      </div>
    </div>
  </div>

  <script>
    let activeInstanceId = null;
    let pollInterval = null;
    let rawDeliveriesData = [];
    let latestInboundMsg = null;
    let cachedInstanceStatus = null;
    let activePairingTab = 'qr';
    let activeSandboxMode = 'text';

    // Transparent Auth Token Handling
    let authToken = localStorage.getItem('wa_gateway_token') || null;
    let currentUser = null;
    let currentOrg = null;

    const nativeFetch = window.fetch;
    window.fetch = async function (input, init) {
      init = init || {};
      init.headers = init.headers || {};
      const urlStr = typeof input === 'string' ? input : (input?.url || '');
      
      if (
        authToken &&
        urlStr.includes('/api/v1/') &&
        !urlStr.includes('/auth/login') &&
        !urlStr.includes('/auth/register') &&
        !urlStr.includes('/auth/demo-login')
      ) {
        const authVal = 'Bearer ' + authToken;
        if (init.headers instanceof Headers) {
          if (!init.headers.has('Authorization')) {
            init.headers.set('Authorization', authVal);
          }
        } else if (Array.isArray(init.headers)) {
          init.headers.push(['Authorization', authVal]);
        } else {
          if (!init.headers['Authorization']) {
            init.headers['Authorization'] = authVal;
          }
        }
      }
      return nativeFetch.apply(window, [input, init]);
    };

    async function ensureAuthenticated() {
      if (authToken) {
        try {
          const res = await nativeFetch('/api/v1/auth/me', {
            headers: { Authorization: 'Bearer ' + authToken }
          });
          if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            currentOrg = data.organization;
            updateNavProfile();
            return;
          }
        } catch {
          // Token invalid or expired, continue to demo-login
        }
      }

      try {
        const res = await nativeFetch('/api/v1/auth/demo-login', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          authToken = data.token;
          currentUser = data.user;
          currentOrg = data.organization;
          localStorage.setItem('wa_gateway_token', authToken);
          updateNavProfile();
        }
      } catch (err) {
        console.error('Auto login error:', err);
      }
    }

    function updateNavProfile() {
      if (currentOrg) {
        const nameEl = document.getElementById('navWorkspaceName');
        const tierEl = document.getElementById('navPlanTier');
        const pillEl = document.getElementById('navOrgPill');
        if (nameEl) nameEl.innerText = currentOrg.name || 'Default Workspace';
        if (tierEl) tierEl.innerText = (currentOrg.plan_tier || 'ENTERPRISE').toUpperCase();
        if (pillEl) pillEl.classList.remove('hidden');
      }
    }

    // 5-Tab Navigation Controller
    function switchInstanceTab(tabKey) {
      const tabs = ['connection', 'events', 'mediaVoice', 'chatsSandbox', 'settings'];
      const tabBtnMap = {
        connection: 'navTabConnection',
        events: 'navTabEvents',
        mediaVoice: 'navTabMediaVoice',
        chatsSandbox: 'navTabChatsSandbox',
        settings: 'navTabSettings',
      };
      const panelMap = {
        connection: 'panelConnection',
        events: 'panelEvents',
        mediaVoice: 'panelMediaVoice',
        chatsSandbox: 'panelChatsSandbox',
        settings: 'panelSettings',
      };

      tabs.forEach((k) => {
        const btn = document.getElementById(tabBtnMap[k]);
        const panel = document.getElementById(panelMap[k]);
        if (k === tabKey) {
          if (btn) btn.className = 'instance-tab-btn active px-3.5 py-2 rounded-xl flex items-center gap-2 transition text-emerald-400 bg-gray-800 border border-emerald-500/30 shrink-0';
          if (panel) panel.classList.remove('hidden');
        } else {
          if (btn) btn.className = 'instance-tab-btn px-3.5 py-2 rounded-xl flex items-center gap-2 transition text-gray-400 hover:text-white shrink-0';
          if (panel) panel.classList.add('hidden');
        }
      });
    }

    function switchPairingTab(tab) {
      activePairingTab = tab;
      const qrTab = document.getElementById('viewQrTab');
      const pairingTab = document.getElementById('viewPairingTab');
      const qrBtn = document.getElementById('tabQrBtn');
      const pairingBtn = document.getElementById('tabPairingBtn');

      if (tab === 'pairing') {
        qrTab.classList.add('hidden');
        pairingTab.classList.remove('hidden');
        pairingBtn.className = 'text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 flex items-center gap-1.5 transition';
        qrBtn.className = 'text-xs px-3 py-1.5 rounded-lg bg-gray-900 text-gray-400 hover:text-white font-medium border border-gray-800 flex items-center gap-1.5 transition';
        
        if (cachedInstanceStatus && cachedInstanceStatus.pairing_phone) {
          document.getElementById('pairingPhoneNumber').value = cachedInstanceStatus.pairing_phone;
        } else if (cachedInstanceStatus && cachedInstanceStatus.phone_number) {
          document.getElementById('pairingPhoneNumber').value = cachedInstanceStatus.phone_number.replace(/[^0-9]/g, '');
        }
      } else {
        pairingTab.classList.add('hidden');
        qrTab.classList.remove('hidden');
        qrBtn.className = 'text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 flex items-center gap-1.5 transition';
        pairingBtn.className = 'text-xs px-3 py-1.5 rounded-lg bg-gray-900 text-gray-400 hover:text-white font-medium border border-gray-800 flex items-center gap-1.5 transition';
      }
    }

    async function requestPairingCode() {
      if (!activeInstanceId) return;
      const phoneInput = document.getElementById('pairingPhoneNumber');
      const rawPhone = phoneInput.value.replace(/[^0-9]/g, '');
      const errEl = document.getElementById('pairingCodeError');
      const resultEl = document.getElementById('pairingCodeResult');
      const boxEl = document.getElementById('pairingCodeBox');
      const btn = document.getElementById('btnRequestPairingCode');

      errEl.classList.add('hidden');
      resultEl.classList.add('hidden');

      if (!rawPhone || rawPhone.length < 8) {
        errEl.innerText = 'Please enter a valid phone number with country code (e.g. 919876543210).';
        errEl.classList.remove('hidden');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Requesting...';

      try {
        const res = await fetch('/api/v1/instances/' + activeInstanceId + '/pairing-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone_number: rawPhone }),
        });
        const data = await res.json();
        if (res.ok && data.pairing_code) {
          boxEl.innerText = data.pairing_code;
          resultEl.classList.remove('hidden');
        } else {
          errEl.innerText = data.error || 'Failed to generate pairing code. Ensure instance is started.';
          errEl.classList.remove('hidden');
        }
      } catch (err) {
        errEl.innerText = 'Network error: ' + err.message;
        errEl.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-key"></i> Get Code';
      }
    }

    function copyPairingCode() {
      const code = document.getElementById('pairingCodeBox').innerText.replace(/\\s+/g, '');
      navigator.clipboard.writeText(code);
      const notice = document.getElementById('copyPairingNotice');
      notice.classList.remove('hidden');
      setTimeout(() => notice.classList.add('hidden'), 2500);
    }

    function formatUrlInput(inputId) {
      const el = document.getElementById(inputId);
      if (!el) return '';
      let val = el.value.trim();
      if (val && !val.startsWith('http://') && !val.startsWith('https://')) {
        if (val.startsWith('localhost') || val.startsWith('127.') || val.startsWith('192.168.') || val.startsWith('10.')) {
          val = 'http://' + val;
        } else {
          val = 'https://' + val;
        }
        el.value = val;
      }
      return val;
    }

    async function loadInstances() {
      try {
        const res = await fetch('/api/v1/instances');
        const data = await res.json();
        const list = document.getElementById('instancesList');
        document.getElementById('instanceCount').innerText = data.length;
        list.innerHTML = '';

        if (data.length === 0) {
          activeInstanceId = null;
          document.getElementById('noInstanceSelected').classList.remove('hidden');
          document.getElementById('instanceDetails').classList.add('hidden');
          return;
        }

        data.forEach(inst => {
          const isSelected = inst.id === activeInstanceId;
          const card = document.createElement('div');
          card.className = 'glass-card rounded-xl p-3.5 cursor-pointer transition hover:border-emerald-500/50 ' + (isSelected ? 'border-emerald-500 glow-green bg-emerald-950/20' : '');
          card.onclick = () => selectInstance(inst.id);

          const statusColor = getStatusColor(inst.status);
          const hasWebhook = Boolean(inst.webhook_url || inst.n8n_webhook_url);

          card.innerHTML = 
            '<div class="flex items-center justify-between">' +
              '<h4 class="font-bold text-sm text-white">' + inst.instance_name + '</h4>' +
              '<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ' + statusColor + '">' + inst.status + '</span>' +
            '</div>' +
            '<div class="text-[11px] text-gray-400 mt-1 flex items-center justify-between">' +
              '<span>' + (inst.phone_number ? '+' + inst.phone_number.replace(/[^0-9]/g, '') : 'Not connected') + '</span>' +
              '<span class="flex items-center gap-1.5">' +
                (hasWebhook ? '<i class="fa-solid fa-satellite-dish text-emerald-400" title="Webhook configured"></i>' : '') +
                '<span class="text-[10px] px-1.5 py-0.2 rounded bg-gray-800 text-gray-300 uppercase">' + inst.ai_provider + '</span>' +
              '</span>' +
            '</div>';
          list.appendChild(card);
        });

        if (!activeInstanceId && data.length > 0) {
          selectInstance(data[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    }

    function getStatusColor(status) {
      switch(status) {
        case 'connected': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        case 'waiting_qr': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
        case 'connecting': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
        case 'reconnecting': return 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30';
        case 'failed': return 'bg-red-500/20 text-red-400 border border-red-500/30';
        default: return 'bg-gray-700/40 text-gray-400 border border-gray-600/30';
      }
    }

    async function selectInstance(id) {
      activeInstanceId = id;
      latestInboundMsg = null;
      document.getElementById('noInstanceSelected').classList.add('hidden');
      document.getElementById('instanceDetails').classList.remove('hidden');

      // Fetch the full instance data once to populate form settings
      try {
        const res = await fetch('/api/v1/instances/' + id);
        if (res.ok) {
          const inst = await res.json();
          populateFormSettings(inst);
        }
      } catch (e) {
        console.error('Failed to load instance settings:', e);
      }

      await loadEventsConfig();
      await refreshTelemetry();
      await loadWebhookDeliveries();
      await loadMessages();
      loadInstances();

      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(async () => {
        await refreshTelemetry();
        await loadWebhookDeliveries();
        await loadMessages();
      }, 3000);
    }

    function populateFormSettings(inst) {
      cachedInstanceStatus = inst;
      document.getElementById('settingAiEnabled').checked = Boolean(inst.ai_enabled);
      document.getElementById('settingAiProvider').value = inst.ai_provider || 'openai';
      document.getElementById('settingAiModel').value = inst.ai_model || '';
      document.getElementById('settingAiSystemPrompt').value = inst.ai_system_prompt || '';
      document.getElementById('settingN8nWebhookUrl').value = inst.n8n_webhook_url || '';
      document.getElementById('settingWebhookUrl').value = inst.webhook_url || '';
      document.getElementById('settingWebhookSecret').value = inst.webhook_secret || '';
      document.getElementById('settingRejectCalls').checked = Boolean(inst.reject_calls);
      document.getElementById('settingIgnoreGroups').checked = Boolean(inst.ignore_groups);
      document.getElementById('settingSandboxMode').checked = Boolean(inst.sandbox_mode);
      document.getElementById('settingOutboundPerMin').value = inst.outbound_per_minute || 30;
      document.getElementById('settingProxyUrl').value = inst.proxy_url || '';
      
      const warmupDay = inst.warmup_day || 1;
      const sentCount = inst.daily_sent_count || 0;
      const limits = [30, 60, 120, 250, 500];
      const dayLimit = warmupDay <= limits.length ? limits[warmupDay - 1] : 500;
      const warmupEl = document.getElementById('settingWarmupBadge');
      if (warmupEl) warmupEl.innerText = 'Day ' + warmupDay + ' • ' + sentCount + '/' + dayLimit + ' msgs';
      
      updatePipelineVisual(inst);
    }

    // Granular Events Matrix loader & saver
    async function loadEventsConfig() {
      if (!activeInstanceId) return;
      try {
        const res = await fetch('/api/v1/instances/' + activeInstanceId + '/events-config');
        if (!res.ok) return;
        const data = await res.json();
        const evts = data.events || {};
        
        const eventKeys = ['messages_upsert', 'messages_update', 'messages_delete', 'presence_update', 'groups_update', 'connection_update'];
        eventKeys.forEach(k => {
          const apiName = k.replace('_', '.');
          const cfg = evts[apiName];
          const toggleEl = document.getElementById('evtToggle_' + k);
          const urlEl = document.getElementById('evtUrl_' + k);
          if (toggleEl) toggleEl.checked = cfg ? Boolean(cfg.enabled) : (['messages_upsert', 'messages_update', 'connection_update'].includes(k));
          if (urlEl) urlEl.value = (cfg && cfg.webhook_url) ? cfg.webhook_url : '';
        });
      } catch (err) {
        console.error('Events config load error:', err);
      }
    }

    async function saveEventsConfig() {
      if (!activeInstanceId) return;
      const statusEl = document.getElementById('eventsSaveStatus');
      statusEl.className = 'text-xs text-blue-400 font-medium text-center';
      statusEl.innerText = 'Saving Events Trigger Matrix...';

      const eventKeys = ['messages_upsert', 'messages_update', 'messages_delete', 'presence_update', 'groups_update', 'connection_update'];
      const payload = {};
      eventKeys.forEach(k => {
        const apiName = k.replace('_', '.');
        const toggleEl = document.getElementById('evtToggle_' + k);
        const urlEl = document.getElementById('evtUrl_' + k);
        payload[apiName] = {
          enabled: toggleEl ? toggleEl.checked : false,
          webhook_url: urlEl && urlEl.value.trim() ? urlEl.value.trim() : null
        };
      });

      try {
        const res = await fetch('/api/v1/instances/' + activeInstanceId + '/events-config', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: payload })
        });
        const data = await res.json();
        if (res.ok) {
          statusEl.className = 'text-xs text-emerald-400 font-semibold text-center';
          statusEl.innerText = '✅ Events Trigger Matrix saved successfully!';
          setTimeout(() => { statusEl.innerText = ''; }, 4000);
        } else {
          statusEl.className = 'text-xs text-rose-400 font-semibold text-center';
          statusEl.innerText = '❌ Failed to save events matrix: ' + (data.error || 'Unknown error');
        }
      } catch (err) {
        statusEl.className = 'text-xs text-rose-400 font-medium text-center';
        statusEl.innerText = 'Error saving events matrix: ' + err.message;
      }
    }

    async function refreshTelemetry() {
      if (!activeInstanceId) return;
      try {
        const res = await fetch('/api/v1/instances/' + activeInstanceId + '/status');
        if (!res.ok) return;
        const inst = await res.json();
        cachedInstanceStatus = inst;
        
        document.getElementById('currentInstanceName').innerText = inst.instance_name;
        document.getElementById('currentInstanceMeta').innerText = 'ID: ' + inst.id + ' | Phone: ' + (inst.phone_number ? '+' + inst.phone_number.replace(/[^0-9]/g, '') : 'N/A') + (inst.proxy_url ? ' | Proxy: Active' : '');
        
        const badge = document.getElementById('currentStatusBadge');
        badge.className = 'text-xs font-semibold px-2.5 py-1 rounded-full border ' + getStatusColor(inst.status);
        badge.innerText = inst.status.toUpperCase();

        const qrImg = document.getElementById('qrImage');
        const qrLoading = document.getElementById('qrLoading');
        const connectedBadge = document.getElementById('connectedBadge');

        if (inst.status === 'connected') {
          qrImg.classList.add('hidden');
          qrLoading.classList.add('hidden');
          connectedBadge.classList.remove('hidden');
        } else if (inst.qr_base64) {
          connectedBadge.classList.add('hidden');
          qrLoading.classList.add('hidden');
          qrImg.src = inst.qr_base64;
          qrImg.classList.remove('hidden');
        } else {
          connectedBadge.classList.add('hidden');
          qrImg.classList.add('hidden');
          qrLoading.classList.remove('hidden');
        }

        updatePipelineVisual(inst);
      } catch (err) {
        console.error('Telemetry refresh error:', err);
      }
    }

    function updatePipelineVisual(inst) {
      if (!inst) return;
      const waBadge = document.getElementById('pipelineWaBadge');
      const waText = document.getElementById('pipelineWaText');
      const waTime = document.getElementById('pipelineWaTime');
      const whBadge = document.getElementById('pipelineWhBadge');
      const whText = document.getElementById('pipelineWhText');
      const whStatus = document.getElementById('pipelineWhStatus');
      const whIcon = document.getElementById('pipelineWhIcon');
      const bannerText = document.getElementById('pipelineBannerText');
      const overallBadge = document.getElementById('pipelineOverallBadge');
      const liveDot = document.getElementById('pipelineLiveDot');

      // 1. WhatsApp status
      if (inst.status === 'connected') {
        waBadge.className = 'text-[9px] px-1.5 py-0.5 rounded font-semibold bg-emerald-500/20 text-emerald-400';
        waBadge.innerText = 'Connected';
        if (latestInboundMsg) {
          const sender = latestInboundMsg.remote_jid.replace('@s.whatsapp.net', '');
          const snippet = (latestInboundMsg.text_content || latestInboundMsg.caption || '[Attachment]').slice(0, 45);
          waText.innerText = '+' + sender + ': "' + snippet + '"';
          waTime.innerText = 'Received ' + new Date(latestInboundMsg.created_at).toLocaleTimeString();
        } else {
          waText.innerText = inst.phone_number ? 'Ready (+' + inst.phone_number.replace(/[^0-9]/g, '') + ')' : 'Listening for inbound messages';
          waTime.innerText = 'Waiting for inbound chat';
        }
      } else {
        waBadge.className = 'text-[9px] px-1.5 py-0.5 rounded font-semibold bg-amber-500/20 text-amber-400';
        waBadge.innerText = inst.status.toUpperCase();
        waText.innerText = 'Not connected to WhatsApp';
        waTime.innerText = 'Scan QR code or use Pairing Code';
      }

      // 2. Webhook status & Live delivery result
      const targetUrl = inst.webhook_url || inst.n8n_webhook_url;
      const latestDelivery = rawDeliveriesData && rawDeliveriesData.length > 0 ? rawDeliveriesData[0] : null;

      if (targetUrl) {
        whText.innerText = targetUrl;
        if (latestDelivery) {
          const dTime = new Date(latestDelivery.created_at).toLocaleTimeString();
          const lat = latestDelivery.duration_ms ? latestDelivery.duration_ms + 'ms' : '<50ms';

          if (latestDelivery.status === 'delivered') {
            whBadge.className = 'text-[9px] px-1.5 py-0.5 rounded font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
            whBadge.innerText = '✅ 200 OK (' + lat + ')';
            whStatus.innerText = 'Last forward: ' + latestDelivery.event_type + ' at ' + dTime;
            whIcon.className = 'w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg shrink-0 mt-0.5';
            bannerText.innerHTML = '<span class="text-emerald-400 font-semibold"><i class="fa-solid fa-circle-check"></i> WhatsApp Data Delivered to Webhook</span> (HTTP 200 OK &bull; ' + lat + ')';
            overallBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
            overallBadge.innerText = 'Delivered (Live)';
            liveDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse';
          } else if (latestDelivery.status === 'retry') {
            whBadge.className = 'text-[9px] px-1.5 py-0.5 rounded font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30';
            whBadge.innerText = '⏳ Retrying #' + latestDelivery.attempts;
            whStatus.innerText = 'Error: ' + (latestDelivery.error_message || 'Retrying');
            whIcon.className = 'w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-lg shrink-0 mt-0.5';
            bannerText.innerHTML = '<span class="text-amber-400 font-semibold"><i class="fa-solid fa-arrows-rotate fa-spin"></i> Webhook Retrying</span> (' + (latestDelivery.error_message || 'In queue') + ')';
            overallBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30';
            overallBadge.innerText = 'Retrying';
            liveDot.className = 'w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping';
          } else if (latestDelivery.status === 'failed') {
            whBadge.className = 'text-[9px] px-1.5 py-0.5 rounded font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30';
            whBadge.innerText = '❌ HTTP ' + (latestDelivery.response_status || 'ERR');
            whStatus.innerText = 'Error: ' + (latestDelivery.error_message || 'Delivery failed');
            whIcon.className = 'w-10 h-10 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center text-lg shrink-0 mt-0.5';
            bannerText.innerHTML = '<span class="text-rose-400 font-semibold"><i class="fa-solid fa-triangle-exclamation"></i> Webhook Delivery Failed</span>';
            overallBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30';
            overallBadge.innerText = 'Failed';
            liveDot.className = 'w-2.5 h-2.5 rounded-full bg-rose-400';
          } else {
            whBadge.className = 'text-[9px] px-1.5 py-0.5 rounded font-semibold bg-blue-500/20 text-blue-400';
            whBadge.innerText = 'Pending';
            whStatus.innerText = 'Dispatch queued';
            whIcon.className = 'w-10 h-10 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-lg shrink-0 mt-0.5';
            bannerText.innerText = 'Webhook dispatch in progress...';
          }
        } else {
          whBadge.className = 'text-[9px] px-1.5 py-0.5 rounded font-semibold bg-teal-500/20 text-teal-400 border border-teal-500/30';
          whBadge.innerText = 'Active Target';
          whStatus.innerText = 'Ready to forward messages';
          whIcon.className = 'w-10 h-10 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center text-lg shrink-0 mt-0.5';
          bannerText.innerText = 'Webhook configured & ready for inbound WhatsApp traffic';
          overallBadge.innerText = 'Ready';
          overallBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-semibold bg-teal-500/20 text-teal-400 border border-teal-500/30';
          liveDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400';
        }
      } else {
        whBadge.className = 'text-[9px] px-1.5 py-0.5 rounded font-semibold bg-gray-800 text-gray-400';
        whBadge.innerText = 'Not Set';
        whText.innerText = 'No webhook configured';
        whStatus.innerText = 'Configure Webhook URL below';
        whIcon.className = 'w-10 h-10 rounded-lg bg-gray-800 text-gray-500 flex items-center justify-center text-lg shrink-0 mt-0.5';
        bannerText.innerHTML = '<span class="text-amber-400"><i class="fa-solid fa-triangle-exclamation"></i> Configure a Webhook URL below to forward chat messages</span>';
        overallBadge.innerText = 'Webhook Not Set';
        overallBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30';
        liveDot.className = 'w-2.5 h-2.5 rounded-full bg-amber-400';
      }

      document.getElementById('pipelineLastUpdate').innerText = 'Checked ' + new Date().toLocaleTimeString();
    }

    async function loadWebhookDeliveries() {
      if (!activeInstanceId) return;
      try {
        const res = await fetch('/api/v1/instances/' + activeInstanceId + '/webhooks/deliveries?limit=50');
        if (!res.ok) return;
        const data = await res.json();
        
        rawDeliveriesData = data.deliveries || [];

        const stats = data.stats || { total: 0, delivered: 0, failed: 0, retrying: 0, avg_latency_ms: 0 };
        document.getElementById('statTotal').innerText = stats.total;
        document.getElementById('statDelivered').innerText = stats.delivered;
        document.getElementById('statFailed').innerText = (stats.failed + stats.retrying);
        document.getElementById('statLatency').innerText = (stats.avg_latency_ms || 0) + ' ms';
        document.getElementById('deliveryCountBadge').innerText = rawDeliveriesData.length;

        renderDeliveries();
      } catch (err) {
        console.error('Webhook deliveries load error:', err);
      }
    }

    function renderDeliveries() {
      const filter = document.getElementById('deliveryFilter').value;
      const container = document.getElementById('webhookDeliveriesList');
      container.innerHTML = '';

      let filtered = rawDeliveriesData;
      if (filter === 'delivered') {
        filtered = rawDeliveriesData.filter(d => d.status === 'delivered');
      } else if (filter === 'failed') {
        filtered = rawDeliveriesData.filter(d => d.status === 'failed' || d.status === 'retry');
      }

      if (filtered.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-500 py-6 text-center">No webhook deliveries recorded yet.</p>';
        return;
      }

      filtered.forEach((d) => {
        const el = document.createElement('div');
        el.className = 'p-3 rounded-xl bg-gray-950/60 border border-gray-800 hover:border-gray-700 transition text-xs space-y-2';

        let statusBadge = '';
        if (d.status === 'delivered') {
          statusBadge = '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold text-[10px]"><i class="fa-solid fa-check"></i> ' + (d.response_status || 200) + ' OK</span>';
        } else if (d.status === 'retry') {
          statusBadge = '<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold text-[10px]"><i class="fa-solid fa-arrows-rotate fa-spin"></i> Retry #' + d.attempts + '</span>';
        } else if (d.status === 'failed') {
          statusBadge = '<span class="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold text-[10px]"><i class="fa-solid fa-circle-exclamation"></i> ' + (d.response_status ? 'HTTP ' + d.response_status : 'Failed') + '</span>';
        } else {
          statusBadge = '<span class="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold text-[10px]"><i class="fa-solid fa-clock"></i> Pending</span>';
        }

        const dateStr = new Date(d.created_at).toLocaleTimeString();
        const latencyStr = d.duration_ms ? d.duration_ms + ' ms' : (d.status === 'delivered' ? '< 50 ms' : '—');

        el.innerHTML = 
          '<div class="flex items-center justify-between gap-2">' +
            '<div class="flex items-center gap-2">' +
              statusBadge +
              '<span class="mono text-[11px] font-semibold text-teal-300 bg-teal-950/40 px-2 py-0.5 rounded border border-teal-800/40">' + d.event_type + '</span>' +
              '<span class="text-gray-400 truncate max-w-[200px] sm:max-w-[320px] text-[11px]" title="' + d.target_url + '">' + d.target_url + '</span>' +
            '</div>' +
            '<div class="text-[11px] text-gray-400 flex items-center gap-2 shrink-0">' +
              '<span class="text-teal-400 font-medium"><i class="fa-solid fa-stopwatch text-[10px]"></i> ' + latencyStr + '</span>' +
              '<span>' + dateStr + '</span>' +
              '<button onclick="toggleDeliveryDetails(\\'' + d.id + '\\')" class="text-gray-400 hover:text-white px-1.5 py-0.5 rounded bg-gray-900 border border-gray-800">' +
                '<i class="fa-solid fa-code"></i>' +
              '</button>' +
              (d.status === 'failed' || d.status === 'retry' ? '<button onclick="retryDelivery(\\'' + d.id + '\\')" title="Retry delivery" class="text-amber-400 hover:text-amber-300 px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-800/40"><i class="fa-solid fa-rotate-right"></i></button>' : '') +
            '</div>' +
          '</div>' +
          '<div id="details-' + d.id + '" class="hidden pt-2 border-t border-gray-900 space-y-1.5">' +
            (d.error_message ? '<div class="p-2 rounded bg-rose-950/30 border border-rose-900/50 text-rose-300 text-[11px]"><strong>Error:</strong> ' + d.error_message + '</div>' : '') +
            (d.response_body ? '<div class="text-[10px] text-gray-400">Response body: <span class="mono text-gray-300">' + d.response_body + '</span></div>' : '') +
            '<div class="flex items-center justify-between text-[10px] text-gray-400">' +
              '<span>Payload Data:</span>' +
              '<button onclick="copyPayload(\\'' + d.id + '\\')" class="text-emerald-400 hover:underline"><i class="fa-solid fa-copy"></i> Copy JSON</button>' +
            '</div>' +
            '<pre id="payload-' + d.id + '" class="p-2 rounded bg-black/60 border border-gray-900 mono text-[10px] text-emerald-300 overflow-x-auto max-h-36">' + JSON.stringify(d.payload, null, 2) + '</pre>' +
          '</div>';
        container.appendChild(el);
      });
    }

    function toggleDeliveryDetails(id) {
      const el = document.getElementById('details-' + id);
      if (el) el.classList.toggle('hidden');
    }

    function copyPayload(id) {
      const el = document.getElementById('payload-' + id);
      if (el) {
        navigator.clipboard.writeText(el.innerText);
        alert('Payload copied to clipboard!');
      }
    }

    async function retryDelivery(deliveryId) {
      if (!activeInstanceId) return;
      try {
        const res = await fetch('/api/v1/instances/' + activeInstanceId + '/webhooks/deliveries/' + deliveryId + '/retry', {
          method: 'POST'
        });
        const data = await res.json();
        if (data.success) {
          await loadWebhookDeliveries();
        } else {
          alert('Retry failed: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Retry error: ' + err.message);
      }
    }

    async function clearDeliveryHistory() {
      if (!activeInstanceId) return;
      if (!confirm('Clear all webhook delivery records for this instance?')) return;
      try {
        await fetch('/api/v1/instances/' + activeInstanceId + '/webhooks/deliveries', { method: 'DELETE' });
        await loadWebhookDeliveries();
      } catch (err) {
        alert('Clear error: ' + err.message);
      }
    }

    async function testWebhook(targetType = 'primary') {
      if (!activeInstanceId) return;
      const statusEl = document.getElementById('webhookSaveStatus');
      const primaryInput = formatUrlInput('settingWebhookUrl');
      const n8nInput = formatUrlInput('settingN8nWebhookUrl');
      const urlInput = targetType === 'n8n' ? n8nInput : primaryInput;
      
      if (!urlInput) {
        statusEl.className = 'text-xs text-amber-400 font-medium text-center';
        statusEl.innerText = 'Please enter a ' + (targetType === 'n8n' ? 'n8n' : 'Primary') + ' Webhook URL first';
        return;
      }

      statusEl.className = 'text-xs text-blue-400 font-medium text-center';
      statusEl.innerText = 'Dispatching test ping to ' + (targetType === 'n8n' ? 'n8n' : 'Primary') + ' Webhook...';

      try {
        const res = await fetch('/api/v1/instances/' + activeInstanceId + '/webhooks/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_type: targetType,
            target_url: urlInput,
            save: true
          })
        });
        const data = await res.json();
        
        await loadWebhookDeliveries();
        await refreshTelemetry();

        if (data.success) {
          const lat = data.delivery?.duration_ms || 0;
          statusEl.className = 'text-xs text-emerald-400 font-semibold text-center';
          statusEl.innerText = '✅ ' + (targetType === 'n8n' ? 'n8n' : 'Primary') + ' Test Delivered! (HTTP ' + (data.delivery?.response_status || 200) + ' OK in ' + lat + 'ms)';
        } else {
          const err = data.delivery?.error_message || data.error || 'Delivery failed';
          statusEl.className = 'text-xs text-rose-400 font-semibold text-center';
          statusEl.innerText = '❌ Test Failed: ' + err;
        }
      } catch (err) {
        statusEl.className = 'text-xs text-rose-400 font-medium text-center';
        statusEl.innerText = 'Network error: ' + err.message;
      }
    }

    async function saveWebhookSettings() {
      if (!activeInstanceId) return;
      const statusEl = document.getElementById('webhookSaveStatus');
      statusEl.className = 'text-xs text-blue-400 font-medium text-center';
      statusEl.innerText = 'Saving webhook configurations...';

      const webhookUrl = formatUrlInput('settingWebhookUrl') || null;
      const n8nWebhookUrl = formatUrlInput('settingN8nWebhookUrl') || null;
      const webhookSecret = document.getElementById('settingWebhookSecret').value.trim() || null;

      try {
        const res = await fetch('/api/v1/instances/' + activeInstanceId, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhook_url: webhookUrl,
            n8n_webhook_url: n8nWebhookUrl,
            webhook_secret: webhookSecret,
          })
        });
        const data = await res.json();
        if (res.ok) {
          populateFormSettings(data);
          statusEl.className = 'text-xs text-emerald-400 font-semibold text-center';
          statusEl.innerText = '✅ Webhook settings saved successfully!';
          setTimeout(() => { statusEl.innerText = ''; }, 4000);
          await loadInstances();
          await refreshTelemetry();
          await loadWebhookDeliveries();
        } else {
          statusEl.className = 'text-xs text-rose-400 font-semibold text-center';
          statusEl.innerText = '❌ Failed to save: ' + (data.error ? (typeof data.error === 'string' ? data.error : JSON.stringify(data.error)) : 'Unknown error');
        }
      } catch (err) {
        statusEl.className = 'text-xs text-rose-400 font-medium text-center';
        statusEl.innerText = 'Save error: ' + err.message;
      }
    }

    // Production Sandbox Controls & Live Mockup
    function switchSandboxMode(mode) {
      activeSandboxMode = mode;
      const modes = ['text', 'media', 'sticker', 'poll'];
      modes.forEach(m => {
        const btn = document.getElementById('sbMode' + m.charAt(0).toUpperCase() + m.slice(1));
        const form = document.getElementById('sbForm' + m.charAt(0).toUpperCase() + m.slice(1));
        if (m === mode) {
          if (btn) btn.className = 'px-2.5 py-1 rounded bg-blue-600/30 text-blue-300 font-bold border border-blue-500/30';
          if (form) form.classList.remove('hidden');
        } else {
          if (btn) btn.className = 'px-2.5 py-1 rounded text-gray-400 hover:text-white';
          if (form) form.classList.add('hidden');
        }
      });
      updateSandboxMockup();
    }

    function updateSandboxMockup() {
      const msgCard = document.getElementById('mockupMsgCard');
      const bodyEl = document.getElementById('mockupBody');
      const mediaBox = document.getElementById('mockupMediaBox');
      const mediaText = document.getElementById('mockupMediaText');
      const stickerCard = document.getElementById('mockupStickerCard');
      const stickerMeta = document.getElementById('mockupStickerMeta');
      const pollCard = document.getElementById('mockupPollCard');
      const pollQuestion = document.getElementById('mockupPollQuestion');
      const pollSubtitle = document.getElementById('mockupPollSubtitle');
      const pollOptions = document.getElementById('mockupPollOptions');

      if (!msgCard || !stickerCard || !pollCard) return;

      // Reset visibility
      msgCard.classList.add('hidden');
      stickerCard.classList.add('hidden');
      pollCard.classList.add('hidden');
      if (mediaBox) mediaBox.classList.add('hidden');

      if (activeSandboxMode === 'text') {
        msgCard.classList.remove('hidden');
        if (bodyEl) bodyEl.innerText = document.getElementById('sbTextBody')?.value.trim() || 'Hello! Welcome to our automated WhatsApp service.';
      } else if (activeSandboxMode === 'media') {
        msgCard.classList.remove('hidden');
        if (mediaBox) mediaBox.classList.remove('hidden');
        const mType = document.getElementById('sbMediaType')?.value || 'image';
        const mUrl = document.getElementById('sbMediaUrl')?.value.trim() || '';
        const mCaption = document.getElementById('sbMediaCaption')?.value.trim() || '';
        const isPtv = document.getElementById('sbMediaPtv')?.checked;
        if (mediaText) mediaText.innerText = (isPtv ? '[Round PTV Video Note] ' : '[' + mType.toUpperCase() + '] ') + (mUrl || 'File Attachment');
        if (bodyEl) bodyEl.innerText = mCaption || (mUrl ? 'Attached ' + mType : 'Attachment preview');
      } else if (activeSandboxMode === 'sticker') {
        stickerCard.classList.remove('hidden');
        const pack = document.getElementById('sbStickerPack')?.value.trim() || 'WhatsApp AI Gateway';
        const author = document.getElementById('sbStickerAuthor')?.value.trim() || 'Antigravity';
        if (stickerMeta) stickerMeta.innerText = 'Pack: ' + pack + ' • Author: ' + author;
      } else if (activeSandboxMode === 'poll') {
        pollCard.classList.remove('hidden');
        const qName = document.getElementById('sbPollName')?.value.trim() || 'Which feature should we build next?';
        const opt1 = document.getElementById('sbPollOpt1')?.value.trim() || 'Option 1';
        const opt2 = document.getElementById('sbPollOpt2')?.value.trim() || 'Option 2';
        const opt3 = document.getElementById('sbPollOpt3')?.value.trim();
        const selCount = document.getElementById('sbPollSelectable')?.value || '1';

        if (pollQuestion) pollQuestion.innerText = qName;
        if (pollSubtitle) pollSubtitle.innerText = selCount === '1' ? 'Select one' : 'Select up to ' + selCount;

        const opts = [opt1, opt2];
        if (opt3) opts.push(opt3);

        const isMulti = selCount !== '1';
        if (pollOptions) {
          pollOptions.innerHTML = opts.map(opt =>
            '<div class="flex items-center gap-2.5 p-2 rounded-lg bg-[#004a3c] border border-emerald-600/30 text-white text-[11px]">' +
              '<div class="w-4 h-4 rounded-' + (isMulti ? 'md' : 'full') + ' border-2 border-emerald-400 flex items-center justify-center shrink-0"></div>' +
              '<span class="truncate">' + opt + '</span>' +
            '</div>'
          ).join('');
        }
      }
    }

    async function dispatchSandboxMessage() {
      if (!activeInstanceId) return;
      const recipient = document.getElementById('sbRecipient')?.value.trim();
      const statusEl = document.getElementById('sbSendStatus');
      if (!recipient) {
        alert('Please enter a recipient phone number with country code');
        return;
      }

      statusEl.className = 'text-xs text-blue-400 font-medium';
      statusEl.innerText = 'Enqueuing ' + activeSandboxMode + ' message...';

      try {
        let endpoint = '/api/v1/whatsapp/send';
        let payload = {
          instance_id: activeInstanceId,
          remote_jid: recipient.includes('@') ? recipient : recipient + '@s.whatsapp.net',
        };

        if (activeSandboxMode === 'text') {
          payload.type = 'text';
          payload.text = document.getElementById('sbTextBody')?.value.trim() || 'Hello from WhatsApp Gateway!';
        } else if (activeSandboxMode === 'media') {
          const mType = document.getElementById('sbMediaType')?.value || 'image';
          if (mType === 'audio') {
            payload.type = 'audio';
            payload.media_url = document.getElementById('sbMediaUrl')?.value.trim() || undefined;
          } else {
            payload.type = 'media';
            payload.media_url = document.getElementById('sbMediaUrl')?.value.trim() || undefined;
            payload.media_type = mType;
            payload.caption = document.getElementById('sbMediaCaption')?.value.trim() || undefined;
            payload.is_ptv = document.getElementById('sbMediaPtv')?.checked || false;
          }
        } else if (activeSandboxMode === 'sticker') {
          endpoint = '/api/v1/whatsapp/send-sticker';
          payload.sticker_url = document.getElementById('sbStickerUrl')?.value.trim() || undefined;
          payload.pack_name = document.getElementById('sbStickerPack')?.value.trim() || 'WhatsApp AI Gateway';
          payload.author_name = document.getElementById('sbStickerAuthor')?.value.trim() || 'Antigravity';
          if (!payload.sticker_url) {
            alert('Please provide a Sticker URL (image or WebP)');
            statusEl.innerText = '';
            return;
          }
        } else if (activeSandboxMode === 'poll') {
          endpoint = '/api/v1/whatsapp/send-poll';
          payload.name = document.getElementById('sbPollName')?.value.trim() || 'Poll Question';
          const o1 = document.getElementById('sbPollOpt1')?.value.trim() || 'Option 1';
          const o2 = document.getElementById('sbPollOpt2')?.value.trim() || 'Option 2';
          const o3 = document.getElementById('sbPollOpt3')?.value.trim();
          const vals = [o1, o2];
          if (o3) vals.push(o3);
          payload.values = vals;
          payload.selectable_count = Number(document.getElementById('sbPollSelectable')?.value) || 1;
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
          statusEl.className = 'text-xs text-emerald-400 font-semibold';
          statusEl.innerText = '✅ ' + activeSandboxMode.toUpperCase() + ' message queued successfully!';
          setTimeout(loadMessages, 1500);
        } else {
          statusEl.className = 'text-xs text-rose-400 font-semibold';
          statusEl.innerText = '❌ Failed: ' + (data.error || 'Could not send');
        }
      } catch (err) {
        statusEl.className = 'text-xs text-rose-400 font-medium';
        statusEl.innerText = 'Network error: ' + err.message;
      }
    }

    async function loadMessages() {
      if (!activeInstanceId) return;
      try {
        const res = await fetch('/api/v1/instances/' + activeInstanceId + '/messages');
        const msgs = await res.json();
        const container = document.getElementById('messagesStream');
        container.innerHTML = '';

        if (!msgs || msgs.length === 0) {
          container.innerHTML = '<p class="text-xs text-gray-500 py-4 text-center">No messages yet.</p>';
          return;
        }

        let foundLatestInbound = null;
        msgs.forEach(m => {
          const text = (m.text_content || m.caption || '').trim();
          if (!text && !m.media_url && m.message_type !== 'location' && m.message_type !== 'contact' && m.message_type !== 'sticker' && m.message_type !== 'poll') {
            return;
          }
          if (m.remote_jid && (
            m.remote_jid.includes('@newsletter') ||
            m.remote_jid.includes('@broadcast') ||
            m.remote_jid === 'status@broadcast' ||
            m.remote_jid === '0@s.whatsapp.net'
          )) {
            return;
          }

          if (m.direction === 'inbound' && !foundLatestInbound) {
            foundLatestInbound = m;
          }

          const isOutbound = m.direction === 'outbound';
          const el = document.createElement('div');
          el.className = 'p-2.5 rounded-xl text-xs ' + (isOutbound ? 'bg-emerald-950/30 border border-emerald-900/40 ml-6' : 'bg-gray-900/60 border border-gray-800 mr-6');
          
          let mediaHtml = '';
          if (m.media_url) {
            if (m.message_type === 'image') {
              mediaHtml = '<div class="mt-1.5"><img src="' + m.media_url + '" class="max-w-[200px] max-h-[160px] rounded-lg border border-gray-700 object-cover" /></div>';
            } else if (m.message_type === 'audio') {
              mediaHtml = '<div class="mt-1.5"><audio controls src="' + m.media_url + '" class="h-8 max-w-[240px]"></audio></div>';
            } else {
              mediaHtml = '<div class="mt-1.5"><a href="' + m.media_url + '" target="_blank" class="text-emerald-400 hover:underline flex items-center gap-1"><i class="fa-solid fa-paperclip"></i> View ' + (m.message_type || 'Attachment') + '</a></div>';
            }
          }

          let interactiveHtml = '';
          let payloadObj = null;
          if (m.raw_payload) {
            try {
              payloadObj = typeof m.raw_payload === 'string' ? JSON.parse(m.raw_payload) : m.raw_payload;
            } catch {}
          }

          if (m.message_type === 'poll') {
            let pollQ = text || 'Poll Question';
            let pollOpts = [];
            if (payloadObj) {
              if (payloadObj.name) pollQ = payloadObj.name;
              const vals = payloadObj.values || payloadObj.options;
              if (Array.isArray(vals)) {
                pollOpts = vals.map(v => typeof v === 'string' ? v : (v.optionName || 'Option'));
              }
            }
            interactiveHtml = '<div class="mt-2 p-2.5 rounded-xl bg-[#004a3c]/60 border border-emerald-500/30 text-white space-y-1.5">' +
              '<div class="flex items-center gap-1.5 text-[10px] text-emerald-300 font-semibold uppercase tracking-wider"><i class="fa-solid fa-square-poll-vertical text-emerald-400"></i> WhatsApp Interactive Poll</div>' +
              '<div class="font-bold text-[11px] text-white">' + pollQ + '</div>' +
              (pollOpts.length > 0 ? ('<div class="space-y-1 pt-1">' + pollOpts.map(o => '<div class="text-[10px] text-emerald-100 flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full border border-emerald-400 shrink-0"></span> ' + o + '</div>').join('') + '</div>') : '') +
            '</div>';
          } else if (m.message_type === 'sticker') {
            interactiveHtml = '<div class="mt-1.5 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-gray-800/80 border border-gray-700 text-teal-300 text-[10px] font-medium">' +
              '<i class="fa-solid fa-note-sticky text-teal-400"></i> WebP Sticker (Custom Pack EXIF)' +
            '</div>';
          }

          el.innerHTML = 
            '<div class="flex items-center justify-between text-[10px] text-gray-400 mb-1">' +
              '<span class="flex items-center gap-1.5">' +
                '<i class="' + (isOutbound ? 'fa-solid fa-arrow-up text-emerald-400' : 'fa-solid fa-arrow-down text-blue-400') + '"></i>' +
                (isOutbound ? 'Outbound &bull; To: ' + m.remote_jid : 'Inbound &bull; From: ' + m.remote_jid) +
              '</span>' +
              '<span>' + new Date(m.created_at).toLocaleTimeString() + '</span>' +
            '</div>' +
            '<p class="text-white select-text">' + (text || (m.media_url ? '[Attachment]' : '')) + '</p>' +
            mediaHtml +
            interactiveHtml;
          container.appendChild(el);
        });

        if (foundLatestInbound && (!latestInboundMsg || latestInboundMsg.id !== foundLatestInbound.id)) {
          latestInboundMsg = foundLatestInbound;
          if (cachedInstanceStatus) updatePipelineVisual(cachedInstanceStatus);
        }

        if (container.children.length === 0) {
          container.innerHTML = '<p class="text-xs text-gray-500 py-4 text-center">No chat messages yet.</p>';
        }
      } catch (err) {
        console.error(err);
      }
    }

    async function triggerInstanceAction(action) {
      if (!activeInstanceId) return;

      if (action === 'delete') {
        const confirmDelete = confirm('Are you sure you want to delete this WhatsApp instance? This action cannot be undone.');
        if (!confirmDelete) return;

        try {
          await fetch('/api/v1/instances/' + activeInstanceId, { method: 'DELETE' });
          activeInstanceId = null;
          await loadInstances();
        } catch (err) {
          alert('Delete error: ' + err.message);
        }
        return;
      }

      try {
        await fetch('/api/v1/instances/' + activeInstanceId + '/' + action, { method: 'POST' });
        setTimeout(refreshTelemetry, 500);
      } catch (err) {
        alert('Action error: ' + err.message);
      }
    }

    async function saveInstanceSettings() {
      if (!activeInstanceId) return;
      const statusEl = document.getElementById('instanceSaveStatus');
      statusEl.className = 'text-xs text-blue-400 font-medium text-center';
      statusEl.innerText = 'Saving instance settings...';

      try {
        const res = await fetch('/api/v1/instances/' + activeInstanceId, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ai_enabled: document.getElementById('settingAiEnabled').checked,
            ai_provider: document.getElementById('settingAiProvider').value,
            ai_model: document.getElementById('settingAiModel').value.trim() || null,
            ai_system_prompt: document.getElementById('settingAiSystemPrompt').value.trim() || null,
            reject_calls: document.getElementById('settingRejectCalls').checked,
            ignore_groups: document.getElementById('settingIgnoreGroups').checked,
            sandbox_mode: document.getElementById('settingSandboxMode').checked,
            outbound_per_minute: parseInt(document.getElementById('settingOutboundPerMin').value || '30', 10),
            proxy_url: document.getElementById('settingProxyUrl').value.trim() || null,
          })
        });
        const data = await res.json();
        if (res.ok) {
          populateFormSettings(data);
          statusEl.className = 'text-xs text-emerald-400 font-semibold text-center';
          statusEl.innerText = '✅ Instance settings saved successfully!';
          setTimeout(() => { statusEl.innerText = ''; }, 4000);
          loadInstances();
        } else {
          statusEl.className = 'text-xs text-rose-400 font-semibold text-center';
          statusEl.innerText = '❌ Error: ' + (data.error ? (typeof data.error === 'string' ? data.error : JSON.stringify(data.error)) : 'Failed to save');
        }
      } catch (err) {
        statusEl.className = 'text-xs text-rose-400 font-medium text-center';
        statusEl.innerText = 'Failed to save settings: ' + err.message;
      }
    }

    function openCreateModal() {
      const errEl = document.getElementById('createErrorMsg');
      if (errEl) { errEl.classList.add('hidden'); errEl.innerText = ''; }
      document.getElementById('newInstanceName').value = '';
      document.getElementById('newWebhookUrl').value = '';
      document.getElementById('newN8nWebhookUrl').value = '';
      document.getElementById('newProxyUrl').value = '';
      document.getElementById('newSandboxMode').checked = false;
      document.getElementById('createModal').classList.remove('hidden');
      document.getElementById('newInstanceName').focus();
    }

    function closeCreateModal() {
      document.getElementById('createModal').classList.add('hidden');
    }

    async function submitCreateInstance() {
      const nameInput = document.getElementById('newInstanceName');
      const name = nameInput.value.trim();
      const aiProvider = document.getElementById('newAiProvider').value;
      const webhookUrl = document.getElementById('newWebhookUrl').value.trim();
      const n8nUrl = document.getElementById('newN8nWebhookUrl').value.trim();
      const proxyUrl = document.getElementById('newProxyUrl').value.trim();
      const sandboxMode = document.getElementById('newSandboxMode').checked;
      const errEl = document.getElementById('createErrorMsg');
      const submitBtn = document.getElementById('btnCreateSubmit');

      if (errEl) { errEl.classList.add('hidden'); errEl.innerText = ''; }

      if (!name || name.length < 2) {
        if (errEl) {
          errEl.innerText = 'Instance name must be at least 2 characters.';
          errEl.classList.remove('hidden');
        } else {
          alert('Instance name must be at least 2 characters.');
        }
        return nameInput.focus();
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Initializing...';
      }

      try {
        const res = await fetch('/api/v1/instances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instance_name: name,
            ai_provider: aiProvider,
            webhook_url: webhookUrl || null,
            n8n_webhook_url: n8nUrl || null,
            proxy_url: proxyUrl || null,
            sandbox_mode: sandboxMode
          })
        });
        const created = await res.json();
        if (!res.ok) {
          const errMsg = typeof created.error === 'string' 
            ? created.error 
            : (created.error ? JSON.stringify(created.error) : 'Failed to create instance');
          if (errEl) {
            errEl.innerText = errMsg;
            errEl.classList.remove('hidden');
          } else {
            alert(errMsg);
          }
          return;
        }
        closeCreateModal();
        await loadInstances();
        selectInstance(created.id);
      } catch (err) {
        if (errEl) {
          errEl.innerText = 'Network error: ' + (err.message || 'Cannot connect to server');
          errEl.classList.remove('hidden');
        } else {
          alert('Failed to create instance: ' + err.message);
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Create & Initialize';
        }
      }
    }

    // API Keys Modal
    async function openApiKeysModal() {
      document.getElementById('apiKeysModal').classList.remove('hidden');
      document.getElementById('newKeyAlert').classList.add('hidden');
      await loadApiKeys();
    }

    function closeApiKeysModal() {
      document.getElementById('apiKeysModal').classList.add('hidden');
    }

    async function loadApiKeys() {
      try {
        const res = await fetch('/api/v1/api-keys');
        if (!res.ok) return;
        const keys = await res.json();
        const list = document.getElementById('apiKeysList');
        list.innerHTML = '';
        if (keys.length === 0) {
          list.innerHTML = '<p class="text-xs text-gray-500 py-4 text-center">No API keys created yet.</p>';
          return;
        }
        keys.forEach(k => {
          const item = document.createElement('div');
          item.className = 'p-3 rounded-xl bg-gray-950/80 border border-gray-800 flex items-center justify-between text-xs';
          item.innerHTML = 
            '<div>' +
              '<span class="font-bold text-white">' + (k.key_name || 'API Key') + '</span>' +
              '<div class="font-mono text-[11px] text-gray-400 mt-0.5">' + (k.key_prefix || 'wag_') + '****************</div>' +
            '</div>' +
            '<div class="flex items-center gap-3">' +
              '<span class="text-[10px] text-gray-500">' + new Date(k.created_at).toLocaleDateString() + '</span>' +
              '<button onclick="revokeApiKey(\\'' + k.id + '\\')" title="Revoke Key" class="text-xs text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-950/30">' +
                '<i class="fa-solid fa-trash"></i>' +
              '</button>' +
            '</div>';
          list.appendChild(item);
        });
      } catch (err) {
        console.error('Failed to load API keys:', err);
      }
    }

    async function generateNewApiKey() {
      const name = prompt('Enter a label for this API Key (e.g. n8n Automation, Make, Backend Server):');
      if (!name) return;
      try {
        const res = await fetch('/api/v1/api-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key_name: name, scopes: ['*'] })
        });
        const data = await res.json();
        if (res.ok && data.api_key) {
          document.getElementById('newKeyValueDisplay').value = data.api_key;
          document.getElementById('newKeyAlert').classList.remove('hidden');
          await loadApiKeys();
        } else {
          alert(data.error || 'Failed to generate key');
        }
      } catch (err) {
        alert('Network error: ' + err.message);
      }
    }

    function copyGeneratedApiKey() {
      const val = document.getElementById('newKeyValueDisplay').value;
      navigator.clipboard.writeText(val);
      alert('API Key copied to clipboard! Save it securely.');
    }

    async function revokeApiKey(id) {
      if (!confirm('Revoke this API Key permanently? Applications using this key will immediately lose access.')) return;
      try {
        await fetch('/api/v1/api-keys/' + id, { method: 'DELETE' });
        await loadApiKeys();
      } catch (err) {
        alert('Revoke error: ' + err.message);
      }
    }

    // Initialize Dashboard
    ensureAuthenticated().then(() => {
      loadInstances();
    });
  </script>
</body>
</html>`;
}
