const fs = require('fs');
const path = require('path');

function patchRustBridge() {
  const possiblePaths = [
    path.join(process.cwd(), 'node_modules', '@whiskeysockets', 'baileys', 'node_modules', 'whatsapp-rust-bridge', 'package.json'),
    path.join(process.cwd(), 'node_modules', 'whatsapp-rust-bridge', 'package.json')
  ];

  for (const pkgPath of possiblePaths) {
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        pkg.main = pkg.main || './dist/index.js';
        pkg.exports = {
          ...(pkg.exports || {}),
          '.': {
            ...(pkg.exports?.['.'] || {}),
            import: './dist/index.js',
            require: './dist/index.js',
            default: './dist/index.js',
            types: './dist/index.d.ts',
          },
        };
        fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
        console.log(`[postinstall] Patched whatsapp-rust-bridge at ${pkgPath} for Node 24 compatibility.`);
      } catch (err) {
        console.warn(`[postinstall] Warning: Failed to patch ${pkgPath}:`, err.message);
      }
    }
  }
}

patchRustBridge();
