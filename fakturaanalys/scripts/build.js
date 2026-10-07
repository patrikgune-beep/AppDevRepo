'use strict';
// Bygger appen:
//   node scripts/build.js            -> www/ (iOS-appen via Capacitor, och webbappen)
//   node scripts/build.js --watch    -> www/ + utvecklingsserver
//   node scripts/build.js --artifact -> dist/fakturaanalys.html, en enda fil som öppnas som länk
//                                       i Claude-appen/Safari (Claude via ditt konto, ingen nyckel)
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const watch = process.argv.includes('--watch');
const artifact = process.argv.includes('--artifact');
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';

const baseOptions = {
  entryPoints: [path.join(root, 'web/main.js')],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: ['safari15'],
  minify: !watch,
  logLevel: 'info',
  define: { __ARTIFACT__: artifact ? 'true' : 'false' },
};

async function buildApp() {
  const out = path.join(root, 'www');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const f of ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
    fs.copyFileSync(path.join(root, 'web', f), path.join(out, f));
  }
  fs.copyFileSync(path.join(root, 'node_modules/sql.js/dist/sql-wasm-browser.wasm'), path.join(out, 'sql-wasm-browser.wasm'));
  const options = { ...baseOptions, outfile: path.join(out, 'app.js'), sourcemap: watch };
  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    const { port } = await ctx.serve({ servedir: out, port: 3100 });
    console.log(`Utvecklingsläge: http://localhost:${port}`);
  } else {
    await esbuild.build(options);
  }
}

// En fil: inline CSS och JS, SQLite som ren JavaScript (ingen WebAssembly), pdf.js från cdnjs.
async function buildArtifact() {
  const sqlAsm = {
    name: 'sql-asm',
    setup(b) {
      b.onResolve({ filter: /^sql\.js$/ }, () => ({ path: path.join(root, 'node_modules/sql.js/dist/sql-asm.js') }));
    },
  };
  const result = await esbuild.build({ ...baseOptions, write: false, outfile: 'app.js', plugins: [sqlAsm],
    external: ['fs', 'path', 'crypto', 'node:fs', 'node:path', 'node:crypto'] });
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  const css = fs.readFileSync(path.join(root, 'web/styles.css'), 'utf8') +
    // Sidan ramas in av Claude, som redan lägger marginal för telefonens statusfält
    '\n.top { top: env(safe-area-inset-top, 0px); padding-top: 12px; }\n';
  const html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
  const bodyStart = html.indexOf('<body>') + '<body>'.length;
  const bodyEnd = html.indexOf('<script src="app.js"></script>');
  const body = html.slice(bodyStart, bodyEnd).trim();
  const page = `<title>Fakturaanalys Bygg</title>
<style>
${css}
</style>
${body}
<script src="${PDFJS}/pdf.min.js"></script>
<script src="${PDFJS}/pdf.worker.min.js"></script>
<script>
${js}
</script>
`;
  const out = path.join(root, 'dist');
  fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, 'fakturaanalys.html');
  fs.writeFileSync(file, page);
  console.log(`${path.relative(root, file)}  ${(page.length / 1e6).toFixed(2)} MB`);
}

(artifact ? buildArtifact() : buildApp()).catch((e) => { console.error(e); process.exit(1); });
