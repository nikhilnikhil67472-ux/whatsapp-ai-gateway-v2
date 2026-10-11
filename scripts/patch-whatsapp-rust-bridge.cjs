const fs = require('fs');
const path = require('path');

function patchRustBridge() {
  const rootDirs = [process.cwd(), path.resolve(__dirname, '..')];
  const possiblePaths = [];

  for (const root of rootDirs) {
    possiblePaths.push(
      path.join(root, 'node_modules', '@whiskeysockets', 'baileys', 'node_modules', 'whatsapp-rust-bridge', 'package.json'),
      path.join(root, 'node_modules', 'whatsapp-rust-bridge', 'package.json')
    );
  }

  const uniquePaths = Array.from(new Set(possiblePaths));

  for (const pkgPath of uniquePaths) {
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
