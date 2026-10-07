'use strict';
// Tolkning av avtalsunderlag (kontrakt, offert, kontraktsbilagor, prislistor, ÄTA-beställningar)
// till mätbara villkor: à-priser, påslag, fast pris, betalningsvillkor och vad som ingår/inte ingår.
const { COST_CATEGORIES, TRADES, UNITS } = require('./taxonomy');
const { tx } = require('./schema');

const DOC_TYPES = ['kontrakt', 'offert', 'kontraktsbilaga', 'prislista', 'ata_bestallning', 'ovrigt'];
const CONTRACT_FORMS = ['fast_pris', 'lopande_rakning', 'riktpris', 'blandat', 'okand'];
const CLAUSE_KINDS = ['ingar', 'ingar_ej', 'ata', 'fakturering', 'ovrigt'];

const nstr = { type: ['string', 'null'] };
const nnum = { type: ['number', 'null'] };
const nullableEnum = (values) => ({ anyOf: [{ type: 'string', enum: values }, { type: 'null' }] });

const CONTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    documents: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          doc_type: { type: 'string', enum: DOC_TYPES },
          title: { type: 'string' },
          source_file: { type: 'string' },
          pages: { type: 'string' },
          doc_date: nstr,
          counterparty: nstr,
          counterparty_orgnr: nstr,
          contract_form: { type: 'string', enum: CONTRACT_FORMS },
          fixed_price: nnum,
          agreement_standard: nstr,
          markup_ue_pct: nnum,
          markup_material_pct: nnum,
          payment_days: nnum,
          ata_requires_written_order: { type: ['boolean', 'null'] },
          rates: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                description: { type: 'string' },
                cost_category: { type: 'string', enum: Object.keys(COST_CATEGORIES) },
                trade: nullableEnum(Object.keys(TRADES)),
                material_type: nstr,
                unit: nullableEnum(UNITS),
                unit_price: nnum,
                page: nstr,
                quote: nstr,
              },
              required: ['description', 'cost_category', 'trade', 'material_type', 'unit', 'unit_price', 'page', 'quote'],
            },
          },
          clauses: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                kind: { type: 'string', enum: CLAUSE_KINDS },
                text: { type: 'string' },
                page: nstr,
              },
              required: ['kind', 'text', 'page'],
            },
          },
        },
        required: ['doc_type', 'title', 'source_file', 'pages', 'doc_date', 'counterparty', 'counterparty_orgnr',
          'contract_form', 'fixed_price', 'agreement_standard', 'markup_ue_pct', 'markup_material_pct', 'payment_days',
          'ata_requires_written_order', 'rates', 'clauses'],
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'documents', 'warnings'],
};

const CONTRACT_PROMPT = `Du läser avtalsunderlag i ett svenskt byggprojekt åt beställaren: kontrakt, offerter,
kontraktsbilagor (t.ex. à-prislista, timprislista, mängdförteckning, administrativa föreskrifter) och
ÄTA-beställningar. Målet är att senare kunna kontrollera fakturor mot avtalet. Läs varje sida.

Regler:
- En post i "documents" per dokument (ett kontrakt, en offert, en bilaga ...).
- contract_form: fast_pris, lopande_rakning (enligt à-priser/timpriser), riktpris, blandat eller okand.
- fixed_price: avtalat fast pris exkl. moms om sådant finns, annars null. Belopp som tal med punkt som decimaltecken.
- markup_ue_pct / markup_material_pct: avtalat påslag i procent på underentreprenörer respektive material
  (t.ex. "entreprenörarvode 12 %" -> 12). Null om inget anges.
- payment_days: betalningsvillkor i dagar. ata_requires_written_order: true om ÄTA ska beställas skriftligt.
- rates: ALLA avtalade priser: timpriser per yrke, à-priser, fasta avgifter (t.ex. servicebil per dag,
  etablering, containerhyra). unit_price = pris för beställaren exkl. moms. Ange yrke (trade) för arbete,
  material_type (gemener, t.ex. "betong", "gips") för material, och enhet normaliserad som på fakturor
  (tim -> h, m² -> m2, m³ -> m3, st). quote = ordagrann text ur avtalet. page = sidnummer.
- clauses: konkreta villkor som påverkar vad som får faktureras, med ordagrann eller nära ordagrann text:
  ingar = vad som ingår i priset (t.ex. "Parkering och resor ingår", "Arbetsledning ingår i timpriset"),
  ingar_ej = undantag som faktureras separat, ata = regler för ändrings- och tilläggsarbeten,
  fakturering = faktureringsregler (intervall, underlag som ska bifogas, förskott, prisjustering), ovrigt.
- Hitta inte på värden: okänt = null. Notera oklarheter och motstridiga uppgifter i warnings.
- summary: 2-4 meningar om vad avtalet omfattar och hur det prissätts.`;

const str = (v) => (v == null || v === '' ? null : String(v));
const num = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/\s/g, '').replace('%', '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);

function normalizeContract(raw) {
  const cx = raw && typeof raw === 'object' ? raw : {};
  return {
    summary: str(cx.summary) || '',
    warnings: Array.isArray(cx.warnings) ? cx.warnings.map(String) : [],
    documents: (Array.isArray(cx.documents) ? cx.documents : []).map((d) => ({
      doc_type: oneOf(d.doc_type, DOC_TYPES, 'ovrigt'),
      title: str(d.title) || 'Avtalsdokument',
      source_file: str(d.source_file) || '',
      pages: str(d.pages) || '',
      doc_date: str(d.doc_date),
      counterparty: str(d.counterparty),
      counterparty_orgnr: str(d.counterparty_orgnr),
      contract_form: oneOf(d.contract_form, CONTRACT_FORMS, 'okand'),
      fixed_price: num(d.fixed_price),
      agreement_standard: str(d.agreement_standard),
      markup_ue_pct: num(d.markup_ue_pct),
      markup_material_pct: num(d.markup_material_pct),
      payment_days: num(d.payment_days),
      ata_requires_written_order: d.ata_requires_written_order == null ? null : Boolean(d.ata_requires_written_order),
      rates: (Array.isArray(d.rates) ? d.rates : []).filter((r) => r && r.description).map((r) => ({
        description: String(r.description),
        cost_category: oneOf(r.cost_category, Object.keys(COST_CATEGORIES), 'ovrigt'),
        trade: r.trade == null ? null : oneOf(r.trade, Object.keys(TRADES), 'ovrigt'),
        material_type: str(r.material_type) && String(r.material_type).toLowerCase().trim(),
        unit: r.unit == null ? null : oneOf(r.unit, UNITS, 'ovrigt'),
        unit_price: num(r.unit_price),
        page: str(r.page),
        quote: str(r.quote),
      })),
      clauses: (Array.isArray(d.clauses) ? d.clauses : []).filter((c) => c && c.text).map((c) => ({
        kind: oneOf(c.kind, CLAUSE_KINDS, 'ovrigt'), text: String(c.text), page: str(c.page),
      })),
    })),
  };
}

function saveContract(db, submissionId, projectId, cx) {
  return tx(db, () => {
    const insTerms = db.prepare(`INSERT INTO contract_terms (submission_id, project_id, doc_type, title, source_file, pages,
      doc_date, counterparty, counterparty_orgnr, contract_form, fixed_price, agreement_standard, markup_ue_pct,
      markup_material_pct, payment_days, ata_requires_written_order, summary) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insRate = db.prepare(`INSERT INTO contract_rates (terms_id, project_id, description, cost_category, trade,
      material_type, unit, unit_price, page, quote) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    const insClause = db.prepare('INSERT INTO contract_clauses (terms_id, project_id, kind, text, page) VALUES (?,?,?,?,?)');
    for (const d of cx.documents) {
      const tid = Number(insTerms.run(submissionId, projectId, d.doc_type, d.title, d.source_file, d.pages, d.doc_date,
        d.counterparty, d.counterparty_orgnr, d.contract_form, d.fixed_price, d.agreement_standard, d.markup_ue_pct,
        d.markup_material_pct, d.payment_days, d.ata_requires_written_order == null ? null : d.ata_requires_written_order ? 1 : 0,
        null).lastInsertRowid);
      for (const r of d.rates) insRate.run(tid, projectId, r.description, r.cost_category, r.trade, r.material_type, r.unit, r.unit_price, r.page, r.quote);
      for (const c of d.clauses) insClause.run(tid, projectId, c.kind, c.text, c.page);
    }
    const addFinding = db.prepare("INSERT INTO findings (submission_id, project_id, invoice_id, severity, source, message) VALUES (?,?,NULL,'varning','tolkning',?)");
    for (const w of cx.warnings) addFinding.run(submissionId, projectId, w);
    db.prepare("UPDATE submissions SET summary = ?, read_log = ?, status = 'done', processed_at = datetime('now'), error = NULL WHERE id = ?")
      .run(cx.summary || null, cx.read_log ? JSON.stringify(cx.read_log) : null, submissionId);
  });
}

module.exports = { CONTRACT_SCHEMA, CONTRACT_PROMPT, normalizeContract, saveContract, DOC_TYPES, CONTRACT_FORMS, CLAUSE_KINDS };
