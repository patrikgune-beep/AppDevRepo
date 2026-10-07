'use strict';
// Gör om en PDF till text per sida (för digitala fakturor) och bilder för sidor utan text
// (skannade bilagor). Körs helt på enheten med pdf.js (global pdfjsLib).

const TEXT_PAGE_MIN_CHARS = 150; // färre tecken än så = troligen skannad sida
const RENDER_LONG_SIDE = 1600;

async function pdfToPages(blob) {
  const pdfjs = globalThis.pdfjsLib;
  if (!pdfjs) throw new Error('PDF-läsaren kunde inte laddas. Kontrollera internetanslutningen och ladda om sidan.');
  const data = new Uint8Array(await blob.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
  const pages = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const text = joinTextItems(content.items);
      let image = null;
      if (text.replace(/\s+/g, '').length < TEXT_PAGE_MIN_CHARS) image = await renderPage(page);
      pages.push({ n, text, image });
      page.cleanup();
    }
  } finally {
    doc.destroy();
  }
  return pages;
}

// Sätter ihop textbitar rad för rad (pdf.js ger dem i läsordning med positioner).
function joinTextItems(items) {
  const lines = [];
  let line = [];
  let lastY = null;
  for (const it of items) {
    if (!('str' in it)) continue;
    const y = Math.round(it.transform[5]);
    if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line.join(' ')); line = []; }
    if (it.str.trim()) line.push(it.str.trim());
    lastY = y;
    if (it.hasEOL) { lines.push(line.join(' ')); line = []; lastY = null; }
  }
  if (line.length) lines.push(line.join(' '));
  return lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

async function renderPage(page) {
  const base = page.getViewport({ scale: 1 });
  const scale = RENDER_LONG_SIDE / Math.max(base.width, base.height);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  canvas.width = 0; canvas.height = 0;
  return blob;
}

// Alla sidor som bilder (för att visa en PDF i appen)
async function renderPdfImages(blob, maxPages = 30) {
  const pdfjs = globalThis.pdfjsLib;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false }).promise;
  const out = [];
  try {
    for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) out.push(await renderPage(await doc.getPage(n)));
  } finally { doc.destroy(); }
  return out;
}

module.exports = { pdfToPages, renderPdfImages, joinTextItems };
