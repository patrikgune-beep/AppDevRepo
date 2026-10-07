'use strict';
// Fritextfrågor: Claude får läsa databasen via en skrivskyddad SQL-funktion och svarar med
// siffror som går att spåra. Varje fråga som körs returneras till användaren.
const { COST_CATEGORIES, TRADES } = require('./taxonomy');
const { baseParams, MODEL, env } = require('./extract');

const MAX_ROWS = 200;
const MAX_STEPS = 12;

const SYSTEM_PROMPT = `Du är en kostnadsanalytiker för byggprojekt och svarar på svenska.
Du svarar på frågor om fakturaunderlag som lagrats i en SQLite-databas. Använd verktyget run_sql
för att hämta siffror – gissa aldrig belopp. Kör hellre flera små frågor än en stor.

Databas (SQLite):
- projects(id, name, description)
- invoices(id, project_id, parent_invoice_id, kind, supplier_name, supplier_orgnr, invoice_number,
  invoice_date, due_date, period_start, period_end, amount_excl_vat, vat_amount, amount_incl_vat,
  reverse_charge_vat, billed_amount, billed_ratio, markup_status, is_duplicate)
  kind: huvudfaktura (entreprenörens faktura till beställaren) | underleverantorsfaktura (bilaga som
  vidarefaktureras) | kvitto | kreditfaktura | ovrigt. billed_ratio = vidarefakturerat belopp /
  bilagans belopp, dvs 1.12 = 12 % påslag. markup_status: ok | avvikelse | saknar_rad | ej_tillampligt.
- cost_lines (VY – använd denna för alla kostnadsanalyser; varje krona finns här exakt en gång):
  line_id, project_id, project_name, invoice_id, invoice_number, invoice_kind, supplier_name (den som
  utförde/levererade), billed_by (den som fakturerade beställaren), line_date, work_month (YYYY-MM då
  arbetet utfördes), invoice_month (YYYY-MM för huvudfakturan), description, cost_category, trade,
  resource_name, material_type, quantity, unit, unit_price (leverantörens à-pris), amount_excl_vat
  (leverantörens belopp), markup_factor, markup_assumed (1 = påslaget är antaget pga avvikelse),
  effective_unit_price (à-pris för beställaren inkl. påslag, exkl. moms), effective_amount
  (beställarens kostnad exkl. moms).
- line_items: samma rader inklusive de som inte räknas (counted = 0, t.ex. huvudfakturans
  klumprader som ersatts av bilagans detaljrader, och dubbletter). Använd bara om frågan gäller
  just det.
- supporting_docs(project_id, invoice_id, doc_type, title, period_start, period_end, text_summary):
  arbetsbeskrivningar, tidrapporter m.m. – använd för frågor om VAD som gjorts.
- findings(project_id, invoice_id, severity, source, message): avvikelser och kontrollpunkter.

cost_category: ${Object.entries(COST_CATEGORIES).map(([k, v]) => `${k} (${v})`).join(', ')}.
trade: ${Object.entries(TRADES).map(([k, v]) => `${k} (${v})`).join(', ')}.
unit: h, st, m, m2, m3, kg, ton, l, dag, vecka, manad, km, sack, pkt, pall, sats, ovrigt.
material_type är fritext i gemener (t.ex. 'betong', 'regel', 'isolering'); sök med LIKE.

Regler:
- Belopp är exkl. moms om inget annat sägs. Ange "kostnad för beställaren" (effective_*) och, när
  det är relevant, leverantörens pris och påslaget.
- Timpris = viktat medel: SUM(quantity*effective_unit_price)/SUM(quantity) där unit = 'h'.
  Redovisa även min/max och antal timmar. Jämför bara priser med samma enhet.
- Respektera avgränsningen (projekt, period, leverantör, kategori) som anges i frågan. Använd
  work_month för period om inget annat sägs.
- Säg tydligt om underlaget är tunt (få rader/projekt), om påslag är antagna, eller om det finns
  varningar i findings som påverkar svaret.
- Svara kort och strukturerat i Markdown, gärna med en tabell. Avsluta med en rad "Underlag:" som
  anger vilka fakturor/leverantörer svaret bygger på.`;

const RUN_SQL_TOOL = {
  name: 'run_sql',
  description: 'Kör en skrivskyddad SQLite-fråga (SELECT eller WITH) mot fakturadatabasen och returnerar ' +
    `högst ${MAX_ROWS} rader som JSON. Använd för alla siffror i svaret.`,
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      sql: { type: 'string', description: 'En enda SELECT/WITH-sats.' },
      purpose: { type: 'string', description: 'Kort beskrivning av vad frågan tar fram.' },
    },
    required: ['sql', 'purpose'],
  },
};

function runReadOnlySql(db, sql) {
  const s = String(sql || '').trim().replace(/;\s*$/, '');
  if (!/^(select|with)\b/i.test(s)) throw new Error('Endast SELECT/WITH tillåts.');
  if (s.includes(';')) throw new Error('Endast en sats åt gången.');
  if (/\b(attach|detach|pragma|insert|update|delete|drop|alter|create|vacuum|reindex)\b/i.test(s)) {
    throw new Error('Otillåtet nyckelord i frågan.');
  }
  // query_only gör att SQLite själv vägrar alla skrivningar under frågan.
  db.prepare('PRAGMA query_only = ON').run();
  let rows;
  try { rows = db.prepare(s).all(); } finally { db.prepare('PRAGMA query_only = OFF').run(); }
  return { rows: rows.slice(0, MAX_ROWS), truncated: rows.length > MAX_ROWS, total_rows: rows.length };
}

function describeScope(db, scope = {}) {
  const parts = [];
  const projects = db.prepare('SELECT id, name FROM projects ORDER BY name').all();
  if (scope.projectIds && scope.projectIds.length) {
    const names = projects.filter((p) => scope.projectIds.map(Number).includes(p.id))
      .map((p) => `${p.name} (id ${p.id})`);
    parts.push(`Projekt: ${names.join(', ')}`);
  } else {
    parts.push(`Projekt: alla (${projects.map((p) => `${p.name} (id ${p.id})`).join(', ') || 'inga'})`);
  }
  if (scope.from || scope.to) {
    const basis = scope.monthBasis === 'invoice' ? 'invoice_month' : 'work_month';
    parts.push(`Period: ${scope.from || 'början'} – ${scope.to || 'nu'} (${basis})`);
  }
  if (scope.supplier) parts.push(`Leverantör: ${scope.supplier}`);
  if (scope.category) parts.push(`Kostnadstyp: ${scope.category}`);
  return parts.join('\n');
}

async function ask(db, { question, scope, history = [] }, { client }) {
  const messages = [
    ...history,
    { role: 'user', content: `Avgränsning:\n${describeScope(db, scope)}\n\nFråga: ${question}` },
  ];
  const queries = [];
  for (let step = 0; step < MAX_STEPS; step++) {
    const resp = await client.beta.messages.create({
      ...baseParams(),
      model: MODEL,
      max_tokens: 16000,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      output_config: { effort: env('ASK_EFFORT') || 'medium' },
      tools: [RUN_SQL_TOOL],
      messages,
    });
    if (resp.stop_reason === 'refusal') return { answer: 'Frågan kunde inte besvaras.', queries };
    messages.push({ role: 'assistant', content: resp.content });
    const toolUses = resp.content.filter((b) => b.type === 'tool_use');
    if (resp.stop_reason !== 'tool_use' || toolUses.length === 0) {
      const answer = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      return { answer, queries };
    }
    const results = [];
    for (const tu of toolUses) {
      try {
        const out = runReadOnlySql(db, tu.input.sql);
        queries.push({ purpose: tu.input.purpose, sql: tu.input.sql, rows: out.total_rows });
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out) });
      } catch (e) {
        queries.push({ purpose: tu.input.purpose, sql: tu.input.sql, error: e.message });
        results.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true, content: e.message });
      }
    }
    messages.push({ role: 'user', content: results });
  }
  return { answer: 'Frågan krävde för många steg. Försök avgränsa den.', queries };
}

module.exports = { ask, runReadOnlySql, describeScope, SYSTEM_PROMPT };
