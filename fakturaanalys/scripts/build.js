'use strict';
// Bygger appen till www/ – används både för iOS-appen (Capacitor) och som webbapp.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
const watch = process.argv.includes('--watch');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
  fs.copyFileSync(path.join(root, 'web', f), path.join(out, f));
}
fs.copyFileSync(path.join(root, 'node_modules/sql.js/dist/sql-wasm-browser.wasm'), path.join(out, 'sql-wasm-browser.wasm'));

const options = {
  entryPoints: [path.join(root, 'web/main.js')],
  bundle: true,
  outfile: path.join(out, 'app.js'),
  platform: 'browser',
  format: 'iife',
  target: ['safari15'],
  minify: !watch,
  sourcemap: watch,
  logLevel: 'info',
};

(async () => {
  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    const { port } = await ctx.serve({ servedir: out, port: 3100 });
    console.log(`Utvecklingsläge: http://localhost:${port}`);
  } else {
    await esbuild.build(options);
  }
})().catch((e) => { console.error(e); process.exit(1); });
