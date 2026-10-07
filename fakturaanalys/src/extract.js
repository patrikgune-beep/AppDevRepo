'use strict';
// Tolkar ett fakturaunderlag (en eller flera filer, PDF inkl. skannade sidor, bilder eller text)
// till strukturerad JSON med Claude och structured outputs.
const Anthropic = require('@anthropic-ai/sdk');

// Miljövariabler finns bara i Node (tester); i appen används standardvärdena.
const env = (name) => (typeof process !== 'undefined' && process.env ? process.env[name] : undefined);
const { COST_CATEGORIES, TRADES, UNITS, INVOICE_KINDS, SUPPORT_TYPES } = require('./taxonomy');

const MODEL = env('CLAUDE_MODEL') || 'claude-opus-5-5';
const MAX_REQUEST_BYTES = 30 * 1024 * 1024; // API-gräns 32 MB per anrop, base64 inräknat
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const str = { type: 'string' };
const nstr = { type: ['string', 'null'] };
const nnum = { type: ['number', 'null'] };
const nullableEnum = (values) => ({ anyOf: [{ type: 'string', enum: values }, { type: 'null' }] });

const LINE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    description: str,
    line_date: nstr,
    article_no: nstr,
    quantity: nnum,
    unit_raw: nstr,
    unit: nullableEnum(UNITS),
    unit_price: nnum,
    amount_excl_vat: nnum,
    cost_category: { type: 'string', enum: Object.keys(COST_CATEGORIES) },
    trade: nullableEnum(Object.keys(TRADES)),
    resource_name: nstr,
    material_type: nstr,
    attachment_ref: nstr,
  },
  required: ['description', 'line_date', 'article_no', 'quantity', 'unit_raw', 'unit', 'unit_price',
    'amount_excl_vat', 'cost_category', 'trade', 'resource_name', 'material_type', 'attachment_ref'],
};

const INVOICE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ref: str,
    kind: { type: 'string', enum: INVOICE_KINDS },
    parent_ref: nstr,
    source_file: str,
    pages: str,
    supplier_name: str,
    supplier_orgnr: nstr,
    invoice_number: nstr,
    invoice_date: nstr,
    due_date: nstr,
    period_start: nstr,
    period_end: nstr,
    project_label: nstr,
    currency: str,
    amount_excl_vat: nnum,
    vat_amount: nnum,
    amount_incl_vat: nnum,
    reverse_charge_vat: { type: 'boolean' },
    lines: { type: 'array', items: LINE_SCHEMA },
  },
  required: ['ref', 'kind', 'parent_ref', 'source_file', 'pages', 'supplier_name', 'supplier_orgnr',
    'invoice_number', 'invoice_date', 'due_date', 'period_start', 'period_end', 'project_label', 'currency',
    'amount_excl_vat', 'vat_amount', 'amount_incl_vat', 'reverse_charge_vat', 'lines'],
};

const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: str,
    invoices: { type: 'array', items: INVOICE_SCHEMA },
    supporting_documents: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          source_file: str,
          pages: str,
          doc_type: { type: 'string', enum: SUPPORT_TYPES },
          title: str,
          period_start: nstr,
          period_end: nstr,
          related_invoice_ref: nstr,
          text_summary: str,
        },
        required: ['source_file', 'pages', 'doc_type', 'title', 'period_start', 'period_end',
          'related_invoice_ref', 'text_summary'],
      },
    },
    warnings: { type: 'array', items: str },
  },
  required: ['summary', 'invoices', 'supporting_documents', 'warnings'],
};

const SYSTEM_PROMPT = `Du tolkar fakturaunderlag från leverantörer i svenska byggprojekt åt en beställare.
Underlaget består ofta av en huvudfaktura från en entreprenör plus bilagor: underleverantörers fakturor
(ofta skannade), kvitton, tidrapporter, arbetsbeskrivningar och följesedlar. Läs varje sida, även
skannade bilder.

Regler:
- Skapa en post i "invoices" för varje faktura/kvitto du hittar. Ge varje post ett unikt ref (F1, F2 ...).
- Entreprenörens faktura till beställaren är "huvudfaktura". En bilagd faktura som entreprenören
  vidarefakturerar är "underleverantorsfaktura" med parent_ref = huvudfakturans ref.
- När en rad på huvudfakturan vidarefakturerar en bilaga (t.ex. "HARD WORKERS OF SWEDEN AB, 33869"
  eller en leverantör + fakturanummer), sätt attachment_ref på den raden till bilagans ref.
  Matcha på fakturanummer/OCR i första hand, leverantörsnamn i andra hand (bolag kan ha olika
  handelsnamn, t.ex. ett varumärke som ingår i en koncern).
- Ta med ALLA rader exakt som de står. Belopp exkl. moms, som tal med punkt som decimaltecken.
  Hitta inte på värden: okänt = null.
- Datum som YYYY-MM-DD. Korta datum som "2/9" tolkas med hjälp av fakturadatum/period (dag/månad).
- unit normaliseras: tim/h/timmar -> h, st/styck -> st, lpm/m -> m, m²/kvm/M2 -> m2, m³/kbm -> m3,
  säck -> sack, paket/pkt/FRP/HNK (förpackning/hink) -> pkt, okänd -> ovrigt. unit_raw = originalet.
- cost_category: arbete = utfört arbete i timmar/ackord; arbetsledning = arbetsledare/projektledare;
  material = byggmaterial; forbrukningsmaterial = klingor, säckar, skydd mm; maskin_hyra = hyrd
  maskin/verktyg; avfall = sophantering/containrar/deponi; transport_frakt = frakt, leverans,
  emballage, pall; fordon_parkering = servicebil, parkering, resor; underentreprenad = en klumpsumma
  från en UE utan specifikation; avgift = tillägg och avgifter (t.ex. trängselavgift, tidspass).
- trade anges för arbete och arbetsledning (vilket yrke utför arbetet, härlett ur beskrivning och
  bilagor; rivningsarbete = rivning). Annars null.
- material_type: kort normaliserad materialbenämning på svenska i gemener för material (t.ex.
  "betong", "regel", "gips", "isolering", "lim", "skruv", "golv", "avfall blandat"). Annars null.
- resource_name: namngiven person eller maskin om den anges.
- Dokument utan belopp (arbetsbeskrivningar, tidrapporter) läggs i supporting_documents med en
  saklig sammanfattning av innehållet (vad som gjorts, period, material).
- warnings: notera oläsliga sidor, summor som inte stämmer, saknade bilagor, dubbletter eller
  annat som beställaren bör kontrollera.
- summary: 2-4 meningar om vad underlaget avser.`;

// file: { original_name, mime_type, data } där data är filens innehåll som base64.
function fileToBlocks(file) {
  const header = { type: 'text', text: `Fil: ${file.original_name}` };
  if (file.mime_type === 'application/pdf') {
    return [header, {
      type: 'document',
      title: file.original_name,
      source: { type: 'base64', media_type: 'application/pdf', data: file.data },
    }];
  }
  if (IMAGE_TYPES.includes(file.mime_type)) {
    return [header, { type: 'image', source: { type: 'base64', media_type: file.mime_type, data: file.data } }];
  }
  // text/csv/plain m.m.
  return [header, { type: 'text', text: decodeBase64Text(file.data) }];
}

function decodeBase64Text(b64) {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

// API-nyckeln sparas bara på enheten. Anropen går direkt från appen till Claude.
function createClient(apiKey) {
  if (!apiKey) throw new Error('Ange din API-nyckel under Inställningar.');
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

function useFallbacks() {
  return env('CLAUDE_DISABLE_FALLBACKS') !== '1';
}

// Gemensamma parametrar för Claude-anrop. Server-side fallback är påslaget:
// om modellen avböjer en begäran tas den om av en fallback-modell i samma anrop.
function baseParams() {
  return useFallbacks() ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {};
}

async function extractSubmission(files, { client, projectName } = {}) {
  const total = files.reduce((s, f) => s + f.data.length, 0);
  if (total * 1.02 > MAX_REQUEST_BYTES) {
    throw new Error(`Underlaget är för stort för ett anrop (${(total * 0.75 / 1e6).toFixed(1)} MB). ` +
      'Dela upp det i flera uppladdningar (max ca 20 MB per uppladdning).');
  }
  const content = [];
  for (const f of files) content.push(...fileToBlocks(f));
  content.push({
    type: 'text',
    text: `Projekt: ${projectName || 'okänt'}. Tolka hela underlaget ovan enligt instruktionerna.`,
  });

  const stream = client.beta.messages.stream({
    ...baseParams(),
    model: MODEL,
    max_tokens: 64000,
    system: SYSTEM_PROMPT,
    output_config: {
      effort: env('EXTRACT_EFFORT') || 'high',
      format: { type: 'json_schema', schema: EXTRACTION_SCHEMA },
    },
    messages: [{ role: 'user', content }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('Claude avböjde att tolka underlaget.');
  if (msg.stop_reason === 'max_tokens') {
    throw new Error('Underlaget innehöll fler rader än vad som ryms i ett svar. Dela upp filen.');
  }
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

// Begripliga felmeddelanden för användaren
function friendlyError(e) {
  if (e instanceof Anthropic.AuthenticationError) return 'Ogiltig API-nyckel (ANTHROPIC_API_KEY).';
  if (e instanceof Anthropic.RateLimitError) return 'För många anrop just nu – försök igen om en stund.';
  if (e instanceof Anthropic.BadRequestError) return `Claude kunde inte ta emot underlaget: ${e.message}`;
  if (e instanceof Anthropic.APIConnectionError) return 'Kunde inte nå Claude – kontrollera internetanslutningen.';
  if (e instanceof Anthropic.APIError) return `Fel från Claude (${e.status}).`;
  return e.message;
}

module.exports = { extractSubmission, friendlyError, env, EXTRACTION_SCHEMA, SYSTEM_PROMPT, createClient, baseParams, MODEL };
