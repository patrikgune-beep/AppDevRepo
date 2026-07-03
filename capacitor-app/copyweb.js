// Kopierar den senaste appen (../index.html) till www/index.html som Capacitor paketerar.
// Kör automatiskt via "npm run sync" / "npm run add:ios".
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "index.html");
const dstDir = path.join(__dirname, "www");
const dst = path.join(dstDir, "index.html");

if (!fs.existsSync(src)) {
  console.error("Hittar inte ../index.html – kör skriptet från capacitor-app/-mappen.");
  process.exit(1);
}
fs.mkdirSync(dstDir, { recursive: true });
fs.copyFileSync(src, dst);
console.log("✓ Kopierade index.html -> www/index.html");
