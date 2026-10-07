'use strict';
// Två sätt att nå Claude, med samma gränssnitt för resten av appen:
//  - sdk:    Claudes API direkt med användarens API-nyckel (iOS-appen och webbläget)
//  - sample: via användarens Claude-konto när appen körs som länk i Claude/Safari (ingen nyckel)
const { extractSubmission, createClient, SYSTEM_PROMPT: EXTRACT_PROMPT, EXTRACTION_SCHEMA } = require('./extract');
const { ask, runReadOnlySql, describeScope, SYSTEM_PROMPT: ASK_PROMPT, RUN_SQL_TOOL } = require('./ask');
const { normalizeExtraction } = require('./normalize');

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
      return extractSubmission(withData, { client: await client(), projectName });
    },
    async ask(db, args) { return ask(db, args, { client: await client() }); },
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

  return {
    mode: 'sample',
    async available() { return true; },
    ensureReady: async () => true,

    async extract(files, { projectName }) {
      const lim = await getLimits();
      const maxImages = lim.images ? lim.images.maxCount : 0;
      const images = [];
      const skipped = [];
      const parts = [];
      for (const f of files) {
        if (f.mime_type === 'application/pdf') {
          const pages = await pdfToPages(f.blob);
          for (const p of pages) {
            let body = p.text || '(ingen text på sidan)';
            if (p.image) {
              if (images.length < maxImages) {
                images.push(p.image);
                body = `[Skannad sida – se bild ${images.length}]`;
              } else {
                skipped.push(`${f.original_name} sida ${p.n}`);
                body = '[Skannad sida som inte kunde skickas med]';
              }
            }
            parts.push(`=== Fil: ${f.original_name}, sida ${p.n} av ${pages.length} ===\n${body}`);
          }
        } else if (f.mime_type.startsWith('image/')) {
          if (images.length < maxImages) {
            images.push(f.blob);
            parts.push(`=== Fil: ${f.original_name} ===\n[Bild ${images.length}]`);
          } else skipped.push(f.original_name);
        } else {
          parts.push(`=== Fil: ${f.original_name} ===\n${(await f.blob.text()).slice(0, 60000)}`);
        }
      }
      const prompt = [
        EXTRACT_PROMPT,
        '',
        'Svara ENBART med ett JSON-objekt som följer detta JSON-schema exakt (alla fält ska finnas, okänt = null):',
        JSON.stringify(EXTRACTION_SCHEMA),
        '',
        `Projekt: ${projectName || 'okänt'}.`,
        images.length ? `Bifogade bilder (${images.length} st) är skannade sidor i den ordning de nämns nedan.` : '',
        '',
        'UNDERLAG (text per sida):',
        parts.join('\n\n'),
      ].join('\n');
      let raw;
      try {
        raw = await sample.json(prompt, { images: images.length ? images : undefined, modelTier: 'default' });
      } catch (e) { throw wrapSampleError(e); }
      const ex = normalizeExtraction(raw);
      if (skipped.length) ex.warnings.push(`Följande skannade sidor kunde inte läsas (för många bilder i ett underlag): ${skipped.join(', ')}. Dela upp filen.`);
      return ex;
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
