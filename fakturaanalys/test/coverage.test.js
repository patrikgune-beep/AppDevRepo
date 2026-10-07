'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePages, coveredPages, linkAttachments, mergeExtraction } = require('../src/coverage');
const { createSampleLlm } = require('../src/llm');
const { normalizeExtraction } = require('../src/normalize');
const fixture = require('../fixtures/karlavagen71.json');

const clone = (x) => JSON.parse(JSON.stringify(x));
const sept = () => clone(fixture.submissions[1].extraction); // 132387: huvudfaktura + 3 bilagor

test('parsePages tolkar sidangivelser', () => {
  assert.deepEqual(parsePages('3'), [3]);
  assert.deepEqual(parsePages('5-6'), [5, 6]);
  assert.deepEqual(parsePages('1–2, 4'), [1, 2, 4]);
  assert.deepEqual(parsePages('sida 7'), [7]);
  assert.deepEqual(parsePages(null), []);
});

test('bilaga som tolkats men inte kopplats kopplas på fakturanummer', () => {
  const ex = sept();
  for (const l of ex.invoices[0].lines) l.attachment_ref = null; // tolkningen missade alla kopplingar
  for (const i of ex.invoices.slice(1)) i.parent_ref = null;
  assert.equal(linkAttachments(ex), 3);
  const line = (start) => ex.invoices[0].lines.find((l) => l.description.startsWith(start));
  assert.equal(line('HARD WORKERS').attachment_ref, 'F2');
  assert.equal(line('Beijer').attachment_ref, 'F3');
  assert.equal(line('Sortera').attachment_ref, 'F4');
  assert.equal(ex.invoices[1].parent_ref, 'F1');
});

test('täckning: saknad Hard Workers-sida upptäcks', () => {
  const ex = sept();
  ex.invoices = ex.invoices.filter((i) => i.supplier_name !== 'Hard Workers of Sweden AB');
  ex.supporting_documents = [];
  const cov = coveredPages(ex, ['Faktura 132387.pdf']).get('Faktura 132387.pdf');
  const missing = [1, 2, 3, 4, 5, 6, 7].filter((n) => !cov.has(n));
  assert.deepEqual(missing, [3, 4]);
});

// Fejkad PDF-läsare: sidorna i 132387 (2 textsidor, 5 skannade)
const fakePages = async () => [1, 2, 3, 4, 5, 6, 7].map((n) => ({ n, text: n <= 2 ? `Fakturanummer 132387 sida ${n} ` + 'x'.repeat(200) : '', image: n > 2 ? new Blob([`bild${n}`], { type: 'image/jpeg' }) : null }));

test('kompletterande tolkning läser sidor som missades och kopplar bilagan', async () => {
  const full = sept();
  const hw = full.invoices.find((i) => i.supplier_name === 'Hard Workers of Sweden AB');
  const calls = [];
  const sample = {
    limits: async () => ({ maxPromptBytes: 262144, images: { maxCount: 20 } }),
    json: async (prompt, opts) => {
      calls.push({ images: opts.images ? opts.images.length : 0, komplett: /KOMPLETTERANDE/.test(prompt) });
      if (calls.length === 1) {
        // Första omgången "missar" Hard Workers (sida 3) och arbetsbeskrivningen (sida 4)
        const ex = sept();
        ex.invoices = ex.invoices.filter((i) => i !== ex.invoices[1]);
        ex.invoices[0].lines.find((l) => l.description.startsWith('HARD')).attachment_ref = null;
        ex.supporting_documents = [];
        return ex;
      }
      assert.match(prompt, /HARD WORKERS OF SWEDEN AB, 33869/); // huvudfakturans öppna rad skickas med
      return { invoices: [{ ...clone(hw), ref: 'B1', parent_ref: 'F1' }], supporting_documents: clone(full.supporting_documents).map((d) => ({ ...d, related_invoice_ref: 'B1' })), warnings: [], summary: '' };
    },
  };
  const llm = createSampleLlm({ sample, pdfToPages: fakePages });
  const ex = await llm.extract([{ original_name: 'Faktura 132387.pdf', mime_type: 'application/pdf', blob: new Blob(['%PDF']) }], { projectName: 'K71' });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].images, 5);
  assert.deepEqual({ images: calls[1].images, komplett: calls[1].komplett }, { images: 2, komplett: true });
  const hwInv = ex.invoices.find((i) => i.invoice_number === '33869');
  assert.ok(hwInv, 'Hard Workers-fakturan finns med');
  assert.equal(ex.invoices[0].lines.find((l) => l.description.startsWith('HARD')).attachment_ref, hwInv.ref);
  assert.deepEqual(ex.read_log, { pages: 7, text_pages: 2, scanned_pages: 5, passes: 2, missing: [] });
});

test('fler skannade sidor än vad ett anrop tar: resten tas i nästa omgång', async () => {
  const full = sept();
  const calls = [];
  const sample = {
    limits: async () => ({ maxPromptBytes: 262144, images: { maxCount: 3 } }),
    json: async (prompt, opts) => {
      calls.push(opts.images ? opts.images.length : 0);
      if (calls.length === 1) { const ex = sept(); ex.invoices = ex.invoices.filter((i) => !['5-6', '7'].includes(i.pages)); return ex; }
      return { invoices: full.invoices.filter((i) => ['5-6', '7'].includes(i.pages)).map((i) => ({ ...i, ref: 'B' + i.ref })), supporting_documents: [], warnings: [] };
    },
  };
  const ex = await createSampleLlm({ sample, pdfToPages: fakePages }).extract(
    [{ original_name: 'Faktura 132387.pdf', mime_type: 'application/pdf', blob: new Blob(['%PDF']) }], {});
  assert.deepEqual(calls, [3, 3]); // omgång 2: sida 5–7 (sida 5 skickades men tolkades inte, 6–7 fick inte plats)
  assert.equal(ex.invoices.length, 4);
  assert.deepEqual(ex.read_log.missing, []);
});

test('sidor som inte går att tolka ger en tydlig varning', async () => {
  const sample = {
    limits: async () => ({ maxPromptBytes: 262144, images: { maxCount: 20 } }),
    json: async () => { const ex = sept(); ex.invoices = [ex.invoices[0]]; ex.supporting_documents = []; return ex; },
  };
  const ex = await createSampleLlm({ sample, pdfToPages: fakePages }).extract(
    [{ original_name: 'Faktura 132387.pdf', mime_type: 'application/pdf', blob: new Blob(['%PDF']) }], {});
  assert.equal(ex.read_log.passes, 2); // en kompletterande omgång, utan framgång
  assert.equal(ex.read_log.missing.length, 5);
  assert.ok(ex.warnings.some((w) => /kunde inte tolkas/.test(w)));
});

test('mergeExtraction byter ref utan att bryta kopplingar', () => {
  const t = normalizeExtraction(sept());
  mergeExtraction(t, normalizeExtraction({ invoices: [{ ref: 'F1', kind: 'kvitto', parent_ref: 'F1', supplier_name: 'X', lines: [] }] }), 'R1');
  const added = t.invoices.at(-1);
  assert.equal(added.ref, 'R1F1');
  assert.equal(added.parent_ref, 'R1F1'.slice(0, 0) + 'R1F1'); // pekar på sig själv i extra -> mappas om
});
