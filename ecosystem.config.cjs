module.exports = {
  apps: [
    {
      name: 'whatsapp-ai-gateway',
      script: 'dist/index.js',
      instances: 1, // Must be 1: preserves WhatsApp WebSocket connection state & prevents SQLite concurrency collisions
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
        UNIFIED_MODE: 'true',
      },
    },
  ],
};
