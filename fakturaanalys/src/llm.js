'use strict';
// Två sätt att nå Claude, med samma gränssnitt för resten av appen:
//  - sdk:    Claudes API direkt med användarens API-nyckel (iOS-appen och webbläget)
//  - sample: via användarens Claude-konto när appen körs som länk i Claude/Safari (ingen nyckel)
const { extractSubmission, createClient, SYSTEM_PROMPT: EXTRACT_PROMPT, EXTRACTION_SCHEMA, fileToBlocks, baseParams, MODEL } = require('./extract');
const { CONTRACT_SCHEMA, CONTRACT_PROMPT, normalizeContract } = require('./contract-extract');
const { REVIEW_SCHEMA } = require('./contract-check');

// Läser text ur ett Claude-svar och tolkar JSON
async function jsonFromStream(client, params) {
  const msg = await client.beta.messages.stream({ ...baseParams(), model: MODEL, max_tokens: 64000, ...params }).finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('Claude avböjde begäran.');
  if (msg.stop_reason === 'max_tokens') throw new Error('Svaret blev för långt. Dela upp underlaget.');
  return JSON.parse(msg.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
}
const { ask, runReadOnlySql, describeScope, SYSTEM_PROMPT: ASK_PROMPT, RUN_SQL_TOOL } = require('./ask');
const { normalizeExtraction } = require('./normalize');
const { coveredPages, linkAttachments, mergeExtraction, openReinvoiceLines } = require('./coverage');

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function createSdkLlm({ getApiKey, makeClient = createClient, toBase64 = blobToBase64 }) {
  const client = async () => {
    const key = await getApiKey();
    if (!key) {
      const e = new Error('Ange din API-nyckel under Inställningar för att kunna tolka fakturor och ställa frågor.');
      e.status = 400;
      throw e;
    }
    return makeClient(key);
  };
  return {
    mode: 'sdk',
    async available() { return Boolean(await getApiKey()); },
    async extract(files, { projectName }) {
      const withData = [];
      for (const f of files) withData.push({ original_name: f.original_name, mime_type: f.mime_type, data: await toBase64(f.blob) });
      const c = await client();
      const ex = await extractSubmission(withData, { client: c, projectName });
      linkAttachments(ex);
      let passes = 1;
      const open = openReinvoiceLines(ex);
      if (open.length) {
        // Riktad omgång: leta upp de vidarefakturerade leverantörsfakturorna bland bilagorna.
        const extra = await extractSubmission(withData, { client: c, projectName, instruction: [
          'KOMPLETTERANDE tolkning. Huvudfakturan vidarefakturerar följande leverantörsfakturor, men de kom inte med i första tolkningen:',
          ...open.map(({ inv, line }) => `- ${inv.ref}: "${line.description}" ${line.amount_excl_vat} kr`),
          'Leta upp var och en bland bilagorna (ofta skannade sidor) och tolka ENBART dessa som "underleverantorsfaktura" med alla rader,',
          `parent_ref = "${open[0].inv.ref}" och rätt invoice_number, samt tillhörande arbetsbeskrivningar. Ta inte med huvudfakturan igen.`,
        ].join('\n') });
        passes++;
        mergeExtraction(ex, { ...extra, invoices: extra.invoices.filter((i) => i.kind !== 'huvudfaktura'), ignored_pages: [] }, 'R1');
        linkAttachments(ex);
      }
      const unlinked = openReinvoiceLines(ex);
      for (const { line } of unlinked) {
        ex.warnings.push(`Leverantörsfakturan för raden "${line.description}" (${line.amount_excl_vat} kr) hittades inte bland bilagorna. Beloppet räknas på leverantören men utan detaljrader.`);
      }
      ex.read_log = { passes, missing: [], unlinked: unlinked.map(({ line }) => line.description) };
      return ex;
    },
    async ask(db, args) { return ask(db, args, { client: await client() }); },
    async extractContract(files) {
      const content = [];
      for (const f of files) content.push(...fileToBlocks({ original_name: f.original_name, mime_type: f.mime_type, data: await toBase64(f.blob) }));
      content.push({ type: 'text', text: 'Tolka avtalsunderlaget ovan enligt instruktionerna.' });
      const raw = await jsonFromStream(await client(), {
        system: CONTRACT_PROMPT,
        output_config: { effort: 'high', format: { type: 'json_schema', schema: CONTRACT_SCHEMA } },
        messages: [{ role: 'user', content }],
      });
      return normalizeContract(raw);
    },
    async review(prompt) {
      return jsonFromStream(await client(), {
        output_config: { effort: 'high', format: { type: 'json_schema', schema: REVIEW_SCHEMA } },
        messages: [{ role: 'user', content: prompt }],
      });
    },
    ensureReady: client,
  };
}

// Översätter felkoder från Claude-kontot till begripliga meddelanden
function sampleErrorMessage(e) {
  const code = e && e.code;
  return ({
    not_granted: 'Appen har inte fått tillåtelse att använda Claude. Ladda om sidan och tillåt när frågan visas.',
    sampling_disabled: 'Claude är inte tillgängligt för ditt konto här.',
    rate_limited: 'För många anrop just nu, eller så är din Claude-användning slut för stunden. Försök igen senare.',
    session_expired: 'Du behöver logga in på Claude igen.',
    prompt_too_large: 'Underlaget är för stort för ett anrop. Dela upp filen.',
    image_rejected: 'En sida kunde inte skickas som bild.',
    invalid_json: 'Svaret från Claude gick inte att läsa. Tryck "Kör om".',
    refused: 'Claude avböjde att tolka underlaget.',
    empty_completion: 'Claude gav inget svar. Tryck "Kör om".',
    cancelled: 'Avbrutet.',
  })[code] || (e && e.message) || 'Något gick fel i anropet till Claude.';
}
const wrapSampleError = (e) => {
  const err = new Error(sampleErrorMessage(e));
  err.code = e && e.code;
  return err;
};

function createSampleLlm({ sample, pdfToPages }) {
  let limits = null;
  const getLimits = async () => (limits ||= await sample.limits().catch(() => ({ maxPromptBytes: 262144 })));

  // Alla sidor i underlaget: text där PDF:en har text, bild där sidan är skannad.
  async function loadPages(files) {
    const pages = [];
    for (const f of files) {
      if (f.mime_type === 'application/pdf') {
        const pp = await pdfToPages(f.blob);
        for (const p of pp) pages.push({ file: f.original_name, n: p.n, of: pp.length, text: p.text, image: p.image });
      } else if (f.mime_type.startsWith('image/')) {
        pages.push({ file: f.original_name, n: 1, of: 1, text: '', image: f.blob });
      } else {
        pages.push({ file: f.original_name, n: 1, of: 1, text: (await f.blob.text()).slice(0, 60000), image: null });
      }
    }
    return pages;
  }

  // Delar upp sidor i omgångar: högst maxImages bilder och ungefär maxText tecken text per omgång.
  function chunkPages(pages, maxImages, maxText) {
    const chunks = [];
    let cur = [];
    let imgs = 0;
    let text = 0;
    for (const p of pages) {
      const t = (p.text || '').length;
      if (cur.length && ((p.image && imgs >= maxImages) || text + t > maxText)) { chunks.push(cur); cur = []; imgs = 0; text = 0; }
      if (p.image && maxImages === 0) continue;
      cur.push(p); if (p.image) imgs++; text += t;
    }
    if (cur.length) chunks.push(cur);
    return chunks;
  }

  return {
    mode: 'sample',
    async available() { return true; },
    ensureReady: async () => true,

    async extract(files, { projectName }) {
      const lim = await getLimits();
      const maxImages = lim.images ? lim.images.maxCount : 0;

      // 1. Dela upp underlaget i sidor: text där PDF:en har text, bild där sidan är skannad.
      const pages = await loadPages(files);
      const fileNames = files.map((f) => f.original_name);
      const label = (p) => `${p.file} sida ${p.n}`;

      // Bygger en omgång: alla givna textsidor, och högst maxImages skannade sidor.
      const pass = async (subset, intro) => {
        const images = [];
        const later = [];
        const parts = [];
        for (const p of subset) {
          let body = p.text || '(ingen text på sidan)';
          if (p.image) {
            if (images.length < maxImages) { images.push(p.image); body = `[Skannad sida – se bild ${images.length}]`; }
            else { later.push(p); continue; }
          }
          parts.push(`=== Fil: ${p.file}, sida ${p.n} av ${p.of} ===\n${body}`);
        }
        const prompt = [
          EXTRACT_PROMPT, '', intro,
          'Ange för varje faktura och bilaga exakt vilka sidor den finns på (pages) och vilken fil (source_file).',
          'Sidor som är tomma eller saknar relevant innehåll anges i "ignored_pages": [{"source_file", "page", "reason"}].',
          'Svara ENBART med ett JSON-objekt som följer detta JSON-schema exakt (alla fält ska finnas, okänt = null), plus fältet ignored_pages:',
          JSON.stringify(EXTRACTION_SCHEMA), '',
          `Projekt: ${projectName || 'okänt'}.`,
          images.length ? `Bifogade bilder (${images.length} st) är skannade sidor i den ordning de nämns nedan.` : '',
          '', 'UNDERLAG (per sida):', parts.join('\n\n'),
        ].join('\n');
        let raw;
        try {
          raw = await sample.json(prompt, { images: images.length ? images : undefined, modelTier: 'default' });
        } catch (e) { throw wrapSampleError(e); }
        return { ex: normalizeExtraction(raw), later };
      };

      // 2. Första omgången: hela underlaget (skannade sidor som inte får plats tas i nästa omgång).
      const first = await pass(pages, 'Tolka hela underlaget nedan.');
      const ex = first.ex;
      let passes = 1;

      // 3. Kompletterande omgångar. Två skäl att läsa igen:
      //    a) sidor som ingen faktura/bilaga täcker (skannade sidor räknas bara om en BILAGA hör dit)
      //    b) rader på huvudfakturan som vidarefakturerar en leverantör (t.ex. "HARD WORKERS OF SWEDEN AB, 33849")
      //       men där leverantörens faktura inte hittades.
      const relevant = (list) => list.filter((p) => p.image || (p.text && p.text.length > 40));
      const uncovered = () => {
        const all = coveredPages(ex, fileNames);
        const att = coveredPages(ex, fileNames, { attachmentsOnly: true });
        const open = openReinvoiceLines(ex).length > 0;
        return pages.filter((p) => {
          if (!p.image) return !(all.get(p.file) || new Set()).has(p.n);
          // En skannad sida som bara huvudfakturan gör anspråk på räknas som tolkad först när inga bilagor saknas.
          return !(att.get(p.file) || new Set()).has(p.n) && (open || !(all.get(p.file) || new Set()).has(p.n));
        });
      };
      let targeted = false;
      for (let round = 1; round <= 4; round++) {
        linkAttachments(ex);
        const open = openReinvoiceLines(ex);
        let missing = relevant(uncovered());
        if (!missing.length) {
          if (!open.length || targeted) break;
          // Alla sidor ser tolkade ut, men bilagor saknas: läs de skannade sidorna (eller allt) igen, riktat.
          missing = pages.some((p) => p.image) ? pages.filter((p) => p.image) : pages;
          targeted = true;
        }
        const known = ex.invoices.map((i) => `${i.ref}: ${i.kind}, ${i.supplier_name}, nr ${i.invoice_number || '?'}, sidor ${i.pages}`).join('\n');
        const openText = open.map(({ inv, line }) => `${inv.ref}: "${line.description}" ${line.amount_excl_vat} kr`).join('\n');
        const intro = [
          'Detta är en KOMPLETTERANDE tolkning av samma underlag. Första tolkningen missade innehåll.',
          open.length ? 'Huvudfakturan vidarefakturerar följande leverantörsfakturor, men de har inte tolkats. Leta upp VAR OCH EN bland sidorna nedan och tolka den som "underleverantorsfaktura" (eller kvitto) med alla rader, parent_ref = huvudfakturans ref och rätt invoice_number:' : '',
          openText,
          'Tolka ENBART sidorna nedan. Skapa nya poster med egna ref (t.ex. B1, B2). Ta också med arbetsbeskrivningar/tidrapporter i supporting_documents.',
          'Redan tolkade fakturor:', known || '(inga)',
        ].filter(Boolean).join('\n');
        const before = missing.length + open.length;
        const r = await pass(missing, intro);
        passes++;
        mergeExtraction(ex, r.ex, `R${round}`);
        linkAttachments(ex);
        const after = relevant(uncovered()).length + openReinvoiceLines(ex).length;
        if (after >= before) break; // ingen framgång
      }
      linkAttachments(ex);

      // 4. Läslogg och varning för sidor som fortfarande saknas.
      const still = relevant(uncovered());
      const unlinked = openReinvoiceLines(ex);
      for (const { line } of unlinked) {
        ex.warnings.push(`Leverantörsfakturan för raden "${line.description}" (${line.amount_excl_vat} kr) hittades inte bland bilagorna. Beloppet räknas på leverantören men utan detaljrader. Tryck "Kör om" eller ladda upp bilagan separat.`);
      }
      if (still.length) ex.warnings.push(`Dessa sidor kunde inte tolkas: ${still.map(label).join(', ')}. Tryck "Kör om", eller ladda upp sidorna som en separat fil.`);
      ex.read_log = {
        pages: pages.length,
        text_pages: pages.filter((p) => !p.image).length,
        scanned_pages: pages.filter((p) => p.image).length,
        passes,
        missing: still.map(label),
        unlinked: unlinked.map(({ line }) => line.description),
      };
      return ex;
    },

    async extractContract(files) {
      const lim = await getLimits();
      const maxImages = lim.images ? lim.images.maxCount : 0;
      const pages = await loadPages(files);
      const chunks = chunkPages(pages, maxImages, 150000);
      const result = { summary: '', warnings: [], documents: [] };
      for (let i = 0; i < chunks.length; i++) {
        const images = [];
        const parts = chunks[i].map((p) => {
          let body = p.text || '(ingen text på sidan)';
          if (p.image) { images.push(p.image); body = `[Skannad sida – se bild ${images.length}]`; }
          return `=== Fil: ${p.file}, sida ${p.n} av ${p.of} ===\n${body}`;
        });
        const prompt = [CONTRACT_PROMPT, '',
          chunks.length > 1 ? `Detta är del ${i + 1} av ${chunks.length} av underlaget. Tolka det som finns i denna del.` : '',
          'Svara ENBART med ett JSON-objekt som följer detta JSON-schema exakt (alla fält ska finnas, okänt = null):',
          JSON.stringify(CONTRACT_SCHEMA), '',
          images.length ? `Bifogade bilder (${images.length} st) är skannade sidor i den ordning de nämns nedan.` : '',
          'UNDERLAG (per sida):', parts.join('\n\n')].join('\n');
        let raw;
        try {
          raw = await sample.json(prompt, { images: images.length ? images : undefined, modelTier: 'default' });
        } catch (e) { throw wrapSampleError(e); }
        const part = normalizeContract(raw);
        result.documents.push(...part.documents);
        result.warnings.push(...part.warnings);
        if (part.summary) result.summary = result.summary ? `${result.summary} ${part.summary}` : part.summary;
      }
      const skipped = maxImages === 0 ? pages.filter((p) => p.image).length : 0;
      if (skipped) result.warnings.push(`${skipped} skannade sidor kunde inte läsas här.`);
      result.read_log = { pages: pages.length, text_pages: pages.filter((p) => !p.image).length,
        scanned_pages: pages.filter((p) => p.image).length, passes: chunks.length, missing: [] };
      return result;
    },

    async review(prompt) {
      try {
        return await sample.json(prompt, { modelTier: 'complex' });
      } catch (e) { throw wrapSampleError(e); }
    },

    async ask(db, { question, scope, history = [] }) {
      const queries = [];
      const tool = {
        name: RUN_SQL_TOOL.name,
        description: RUN_SQL_TOOL.description,
        inputSchema: RUN_SQL_TOOL.input_schema,
        execute: (input) => {
          const sql = String(input.sql || '');
          try {
            const out = runReadOnlySql(db, sql);
            let rows = out.rows;
            // Verktygssvar får vara högst 32 KB
            while (rows.length > 1 && JSON.stringify(rows).length > 28000) rows = rows.slice(0, Math.ceil(rows.length / 2));
            queries.push({ purpose: String(input.purpose || ''), sql, rows: out.total_rows });
            return { rows, truncated: out.truncated || rows.length < out.rows.length, total_rows: out.total_rows };
          } catch (e) {
            queries.push({ purpose: String(input.purpose || ''), sql, error: e.message });
            throw e;
          }
        },
      };
      const turns = [
        { role: 'user', content: `${ASK_PROMPT}\n\nFörsta frågan följer.` },
        ...history,
        { role: 'user', content: `Avgränsning:\n${describeScope(db, scope)}\n\nFråga: ${question}` },
      ];
      try {
        const r = await sample(turns, { tools: [tool], modelTier: 'default' });
        return { answer: r.text.trim(), queries };
      } catch (e) { throw wrapSampleError(e); }
    },
  };
}

module.exports = { createSdkLlm, createSampleLlm, blobToBase64, sampleErrorMessage };
