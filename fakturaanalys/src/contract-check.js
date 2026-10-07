'use strict';
// Kontroll av fakturor mot avtalsunderlaget. Två sorters resultat:
//  - "kontroll":  beräknat (fel à-pris, för högt påslag, över fast pris, betalningsvillkor, poster som
//                 enligt avtalstexten kan ingå i priset). Samma svar varje gång.
//  - "bedomning": Claudes granskning av avtalstext mot fakturorna (se buildReviewPrompt), alltid med
//                 hänvisning till avtalet så att beställaren kan avgöra själv.
const { tx } = require('./schema');
const { COST_CATEGORIES, TRADES } = require('./taxonomy');

const fmt = (n) => (n == null ? '–' : Number(n).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const round2 = (n) => Math.round(n * 100) / 100;
const pct = (n) => Number(n).toLocaleString('sv-SE', { maximumFractionDigits: 1, minimumFractionDigits: n % 1 ? 1 : 0 });

const GENERIC = new Set(['enligt', 'arbete', 'arbeten', 'kostnad', 'kostnader', 'avgift', 'pris', 'priser', 'timpris', 'timme',
  'timmar', 'faktura', 'faktureras', 'ingår', 'ingar', 'samt', 'eller', 'inkl', 'exkl', 'moms', 'material', 'övrigt',
  'debiteras', 'tillkommer', 'projekt', 'entreprenad', 'entreprenören', 'beställaren', 'sweden', 'byggentreprenad']);
const words = (s) => String(s || '').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/)
  .filter((w) => w.length >= 5 && !GENERIC.has(w) && !/^\d+$/.test(w));
const stem = (w) => w.slice(0, 6);
const sharedStems = (a, b) => {
  const sb = new Set(words(b).map(stem));
  return [...new Set(words(a).map(stem))].filter((w) => sb.has(w));
};
const sameCompany = (a, b) => {
  const wa = words(a).filter((w) => !['aktiebolag'].includes(w));
  return wa.length > 0 && sharedStems(a, b).length > 0;
};
const isAta = (inv) => /ä\s*t\s*a|ändrings|tilläggs/i.test(`${inv.project_label || ''} ${inv.description || ''}`);

// Samlade avtalsvillkor för projektet: skalärer från kontraktet i första hand, sedan offert, bilagor.
function contractFor(db, projectId) {
  const order = { kontrakt: 0, offert: 1, kontraktsbilaga: 2, prislista: 3, ata_bestallning: 4, ovrigt: 5 };
  const docs = db.prepare('SELECT * FROM contract_terms WHERE project_id = ?').all(projectId)
    .sort((a, b) => (order[a.doc_type] ?? 9) - (order[b.doc_type] ?? 9));
  if (!docs.length) return null;
  const first = (k) => { const d = docs.find((x) => x[k] != null && x[k] !== 'okand'); return d ? { value: d[k], doc: d } : { value: null, doc: null }; };
  return {
    docs,
    counterparty: first('counterparty').value,
    contract_form: first('contract_form').value || 'okand',
    fixed_price: first('fixed_price'),
    markup_ue_pct: first('markup_ue_pct'),
    markup_material_pct: first('markup_material_pct'),
    payment_days: first('payment_days'),
    ata_requires_written_order: first('ata_requires_written_order').value === 1,
    has_ata_order: docs.some((d) => d.doc_type === 'ata_bestallning'),
    rates: db.prepare('SELECT r.*, t.title AS doc_title FROM contract_rates r JOIN contract_terms t ON t.id = r.terms_id WHERE r.project_id = ?').all(projectId),
    clauses: db.prepare('SELECT c.*, t.title AS doc_title FROM contract_clauses c JOIN contract_terms t ON t.id = c.terms_id WHERE c.project_id = ?').all(projectId),
  };
}

const ref = (doc, page, quote) => [doc, page ? `s. ${page}` : null, quote ? `"${quote}"` : null].filter(Boolean).join(', ');

// Bästa avtalspris för en fakturarad, eller null.
function matchRate(line, rates) {
  let best = null;
  for (const r of rates) {
    if (r.unit_price == null) continue;
    if (r.unit && line.unit && r.unit !== line.unit) continue;
    let score = 0;
    if (line.trade && r.trade && line.trade === r.trade) score += 3;
    if (line.material_type && r.material_type && (line.material_type.includes(r.material_type) || r.material_type.includes(line.material_type))) score += 3;
    score += Math.min(2, sharedStems(line.description, r.description).length) * 2;
    if (line.cost_category === r.cost_category) score += 1;
    if (score < 3) continue;
    // Vid flera lika bra träffar (t.ex. vardag/kväll) väljs det högsta priset – hellre missa än larma i onödan.
    if (!best || score > best.score || (score === best.score && r.unit_price > best.rate.unit_price)) best = { rate: r, score };
  }
  return best && best.rate;
}

function runContractChecks(db, projectId) {
  const c = contractFor(db, projectId);
  const out = [];
  if (c) {
    const invoices = db.prepare('SELECT * FROM invoices WHERE project_id = ? AND is_duplicate = 0').all(projectId);
    const invById = new Map(invoices.map((i) => [i.id, i]));
    const top = (inv) => { let cur = inv; let guard = 0; while (cur.parent_invoice_id && invById.has(cur.parent_invoice_id) && guard++ < 10) cur = invById.get(cur.parent_invoice_id); return cur; };
    let lines = db.prepare(`SELECT li.*, i.invoice_number FROM line_items li JOIN invoices i ON i.id = li.invoice_id
      WHERE li.project_id = ? AND li.counted = 1`).all(projectId);
    // Avtalet gäller den entreprenör som fakturerar beställaren
    if (c.counterparty && lines.some((l) => sameCompany(c.counterparty, l.billed_by))) {
      lines = lines.filter((l) => sameCompany(c.counterparty, l.billed_by));
    }
    const topInvoiceIds = new Set(lines.map((l) => top(invById.get(l.invoice_id) || { id: l.invoice_id }).id));
    const ataInvoice = (l) => { const t = invById.get(l.invoice_id); return t ? isAta(top(t)) : false; };

    // 1. À-pris/timpris mot avtalspris
    const missing = new Map();
    for (const l of lines) {
      if (l.effective_unit_price == null || !(l.quantity > 0)) continue;
      const r = matchRate(l, c.rates);
      if (r) {
        const tol = Math.max(0.5, r.unit_price * 0.005);
        if (l.effective_unit_price > r.unit_price + tol) {
          const diff = l.effective_unit_price - r.unit_price;
          out.push({ check_type: 'fel_pris', severity: 'varning', invoice_id: l.invoice_id, line_id: l.id,
            title: `Högre pris än avtalat: ${l.description}`,
            detail: `Fakturerat ${fmt(l.effective_unit_price)} kr/${l.unit || 'st'} mot avtalat ${fmt(r.unit_price)} kr/${r.unit || l.unit || 'st'} × ${fmt(l.quantity)} = ${fmt(diff * l.quantity)} kr för mycket (faktura ${l.invoice_number || '?'}, ${l.supplier_name}).${l.markup_assumed ? ' Obs: påslaget på denna rad är antaget.' : ''}`,
            contract_ref: ref(r.doc_title, r.page, r.quote || r.description), amount: round2(diff * l.quantity), key: `fel_pris:${l.id}` });
        }
      } else if (['arbete', 'arbetsledning'].includes(l.cost_category) && c.rates.length && ['lopande_rakning', 'blandat', 'riktpris'].includes(c.contract_form)) {
        const k = `${l.trade || l.cost_category}|${l.unit || ''}`;
        const m = missing.get(k) || { trade: l.trade, category: l.cost_category, unit: l.unit, qty: 0, amount: 0, n: 0 };
        m.qty += l.quantity; m.amount += l.effective_amount || 0; m.n++;
        missing.set(k, m);
      }
    }
    for (const [k, m] of missing) {
      out.push({ check_type: 'saknar_avtalspris', severity: 'info', title: `Avtalat pris saknas: ${m.trade ? TRADES[m.trade] || m.trade : COST_CATEGORIES[m.category]}`,
        detail: `${m.n} rader, ${fmt(m.qty)} ${m.unit || ''}, ${fmt(m.amount)} kr har fakturerats utan motsvarande pris i avtalsunderlaget. Kontrollera vilket pris som gäller.`,
        contract_ref: null, amount: null, key: `saknar_avtalspris:${k}` });
    }

    // 2. Poster som enligt avtalstexten ingår i priset
    const includes = c.clauses.filter((x) => x.kind === 'ingar');
    const excludes = c.clauses.filter((x) => x.kind === 'ingar_ej');
    for (const l of lines) {
      for (const cl of includes) {
        const hit = sharedStems(cl.text, `${l.description} ${l.material_type || ''}`);
        if (!hit.length) continue;
        if (excludes.some((ex) => sharedStems(ex.text, l.description).length >= hit.length)) continue;
        if (ataInvoice(l)) continue; // ÄTA bedöms separat
        out.push({ check_type: 'ingar_i_avtal', severity: 'varning', invoice_id: l.invoice_id, line_id: l.id,
          title: `Kan ingå i avtalat pris: ${l.description}`,
          detail: `${fmt(l.effective_amount)} kr har fakturerats separat (faktura ${l.invoice_number || '?'}, ${l.supplier_name}), men avtalet säger att detta ingår. Kontrollera om posten är debiterbar.`,
          contract_ref: ref(cl.doc_title, cl.page, cl.text), amount: l.effective_amount, key: `ingar_i_avtal:${l.id}:${cl.id}` });
        break;
      }
    }

    // 3. Påslag på underentreprenörer och material. Rader som redan flaggats för fel pris eller
    //    för att ingå i avtalet räknas inte igen här (annars dubbelräknas överdebiteringen).
    const flagged = new Set(out.filter((f) => f.line_id && ['fel_pris', 'ingar_i_avtal'].includes(f.check_type)).map((f) => f.line_id));
    const linesByInv = new Map();
    for (const l of db.prepare('SELECT id, invoice_id, cost_category, amount_excl_vat FROM line_items WHERE project_id = ?').all(projectId)) {
      if (!linesByInv.has(l.invoice_id)) linesByInv.set(l.invoice_id, []);
      linesByInv.get(l.invoice_id).push(l);
    }
    for (const inv of invoices) {
      if (inv.markup_status !== 'ok' || inv.billed_ratio == null || !topInvoiceIds.has(top(inv).id)) continue;
      const own = linesByInv.get(inv.id) || [];
      const sum = (cats) => own.filter((l) => cats.includes(l.cost_category)).reduce((s, l) => s + (l.amount_excl_vat || 0), 0);
      const total = own.reduce((s, l) => s + (l.amount_excl_vat || 0), 0);
      const isMaterial = total > 0 && sum(['material', 'forbrukningsmaterial']) / total > 0.5;
      const allowed = isMaterial ? c.markup_material_pct : c.markup_ue_pct;
      if (allowed.value == null) continue;
      const actual = (inv.billed_ratio - 1) * 100;
      if (actual > allowed.value + 0.1) {
        const base = inv.amount_excl_vat ?? total;
        const excess = inv.billed_ratio - 1 - allowed.value / 100;
        const flaggedBase = own.filter((l) => flagged.has(l.id)).reduce((s, l) => s + (l.amount_excl_vat || 0), 0);
        const over = (inv.billed_amount - base * (1 + allowed.value / 100)) - flaggedBase * excess;
        if (over < 0.5) continue;
        out.push({ check_type: 'fel_paslag', severity: 'varning', invoice_id: inv.id,
          title: `För högt påslag på ${inv.supplier_name} ${inv.invoice_number || ''}`.trim(),
          detail: `Påslag ${pct(actual)} % mot avtalat ${pct(allowed.value)} % på ${isMaterial ? 'material' : 'underentreprenad'}: ${fmt(base)} kr har vidarefakturerats som ${fmt(inv.billed_amount)} kr, ${fmt(over)} kr för mycket${flaggedBase ? ` (exkl. ${fmt(flaggedBase)} kr på rader som redan flaggats ovan)` : ''}.`,
          contract_ref: ref(allowed.doc && allowed.doc.title, allowed.doc && allowed.doc.pages, null), amount: round2(over), key: `fel_paslag:${inv.id}` });
      }
    }

    // 4. Fast pris: fakturerat (utom ÄTA) över avtalad summa
    const fp = c.fixed_price.value;
    if (c.contract_form === 'fast_pris' && fp) {
      const invoiced = lines.filter((l) => !ataInvoice(l)).reduce((s, l) => s + (l.effective_amount || 0), 0);
      if (invoiced > fp + 1) {
        out.push({ check_type: 'over_fast_pris', severity: 'varning', title: 'Fakturerat över avtalat fast pris',
          detail: `Fakturerat exkl. ÄTA ${fmt(invoiced)} kr mot avtalat fast pris ${fmt(fp)} kr.`,
          contract_ref: ref(c.fixed_price.doc.title, c.fixed_price.doc.pages, null), amount: round2(invoiced - fp), key: 'over_fast_pris' });
      }
    }

    // 5. ÄTA utan skriftlig beställning
    if (c.ata_requires_written_order && !c.has_ata_order) {
      const ata = invoices.filter((i) => !i.parent_invoice_id && isAta(i) && topInvoiceIds.has(i.id));
      for (const i of ata) {
        out.push({ check_type: 'ata', severity: 'varning', invoice_id: i.id, title: `ÄTA utan beställning i underlaget: faktura ${i.invoice_number || ''}`,
          detail: `Avtalet kräver skriftlig beställning av ÄTA, men ingen ÄTA-beställning finns bland avtalsdokumenten. Fakturerat ${fmt(i.amount_excl_vat)} kr exkl. moms.`,
          contract_ref: ref(c.clauses.find((x) => x.kind === 'ata')?.doc_title, c.clauses.find((x) => x.kind === 'ata')?.page, c.clauses.find((x) => x.kind === 'ata')?.text), amount: null, key: `ata:${i.id}` });
      }
    }

    // 6. Betalningsvillkor
    if (c.payment_days.value) {
      for (const i of invoices.filter((x) => !x.parent_invoice_id && topInvoiceIds.has(x.id) && x.invoice_date && x.due_date)) {
        const days = Math.round((Date.parse(i.due_date) - Date.parse(i.invoice_date)) / 86400000);
        if (days < c.payment_days.value) {
          out.push({ check_type: 'betalningsvillkor', severity: 'info', invoice_id: i.id, title: `Kortare betalningstid: faktura ${i.invoice_number || ''}`,
            detail: `Fakturan har ${days} dagars betalningstid mot avtalade ${c.payment_days.value} dagar. Förfallodagen kan flyttas till ${new Date(Date.parse(i.invoice_date) + c.payment_days.value * 86400000).toISOString().slice(0, 10)}.`,
            contract_ref: ref(c.payment_days.doc.title, c.payment_days.doc.pages, null), amount: null, key: `betalningsvillkor:${i.id}` });
        }
      }
    }
  }
  storeFindings(db, projectId, 'kontroll', out);
  return out.length;
}

function storeFindings(db, projectId, source, findings) {
  tx(db, () => {
    db.prepare('DELETE FROM review_findings WHERE project_id = ? AND source = ?').run(projectId, source);
    const dismissed = new Set(db.prepare('SELECT dedupe_key FROM review_dismissed WHERE project_id = ?').all(projectId).map((r) => r.dedupe_key));
    const ins = db.prepare(`INSERT INTO review_findings (project_id, source, check_type, severity, invoice_id, line_id, title, detail,
      contract_ref, amount, dedupe_key) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    for (const f of findings) {
      const key = `${source}:${f.key}`;
      if (dismissed.has(key)) continue;
      ins.run(projectId, source, f.check_type, f.severity, f.invoice_id || null, f.line_id || null, f.title, f.detail || null,
        f.contract_ref || null, f.amount == null ? null : round2(f.amount), key);
    }
  });
}

// ---- Claudes bedömning
const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          check_type: { type: 'string', enum: ['fel_pris', 'fel_paslag', 'ingar_i_avtal', 'ej_debiterbar', 'ata', 'saknar_underlag', 'ovrigt'] },
          severity: { type: 'string', enum: ['varning', 'info'] },
          line_ids: { type: 'array', items: { type: 'integer' } },
          title: { type: 'string' },
          detail: { type: 'string' },
          contract_ref: { type: 'string' },
          amount: { type: ['number', 'null'] },
        },
        required: ['check_type', 'severity', 'line_ids', 'title', 'detail', 'contract_ref', 'amount'],
      },
    },
  },
  required: ['findings'],
};

function buildReviewPrompt(db, projectId) {
  const c = contractFor(db, projectId);
  if (!c) return null;
  const docs = c.docs.map((d) => `- ${d.title} (${d.doc_type}${d.doc_date ? ', ' + d.doc_date : ''}): motpart ${d.counterparty || '?'}, form ${d.contract_form}, fast pris ${d.fixed_price ?? '–'}, påslag UE ${d.markup_ue_pct ?? '–'} %, material ${d.markup_material_pct ?? '–'} %, betalning ${d.payment_days ?? '–'} dagar, ÄTA skriftligt: ${d.ata_requires_written_order == null ? '?' : d.ata_requires_written_order ? 'ja' : 'nej'}`).join('\n');
  const rates = c.rates.map((r) => `- ${r.description}: ${r.unit_price ?? '?'} kr/${r.unit || '?'} [${r.doc_title}${r.page ? ' s. ' + r.page : ''}]`).join('\n');
  const clauses = c.clauses.map((x) => `- (${x.kind}) "${x.text}" [${x.doc_title}${x.page ? ' s. ' + x.page : ''}]`).join('\n');
  const lines = db.prepare(`SELECT line_id, invoice_number, supplier_name, billed_by, line_date, description, cost_category, quantity, unit,
    effective_unit_price, effective_amount FROM cost_lines WHERE project_id = ? ORDER BY invoice_number, line_id LIMIT 1500`).all(projectId);
  const table = lines.map((l) => [l.line_id, l.invoice_number, l.supplier_name, l.line_date || '', l.description.slice(0, 90), l.cost_category,
    l.quantity ?? '', l.unit || '', l.effective_unit_price ?? '', l.effective_amount ?? ''].join(' | ')).join('\n');
  const already = db.prepare("SELECT title FROM review_findings WHERE project_id = ? AND source = 'kontroll'").all(projectId).map((f) => `- ${f.title}`).join('\n');
  const docsText = db.prepare("SELECT title, text_summary FROM supporting_docs WHERE project_id = ?").all(projectId).map((d) => `- ${d.title}: ${d.text_summary}`).join('\n');
  return `Du granskar fakturor i ett svenskt byggprojekt mot avtalsunderlaget, åt beställaren.
Hitta kostnader som enligt avtalet inte ska faktureras (ingår i priset, ingår ej i åtagandet, saknar
beställning), som fakturerats till fel pris eller med fel påslag, eller som saknar underlag som avtalet kräver.

Regler:
- Bygg varje fynd på en konkret avtalstext och ange den i contract_ref (dokument, sida, citat).
- line_ids = id för berörda fakturarader ur tabellen nedan. amount = möjlig överdebitering exkl. moms (null om okänt).
- severity "varning" när avtalet tydligt talar emot posten, "info" när det är oklart och bör frågas om.
- Upprepa inte fynd som redan finns i listan "Redan hittat". Hitta inte på villkor som inte står i avtalet.
- Svara ENBART med JSON: {"findings": [{"check_type", "severity", "line_ids", "title", "detail", "contract_ref", "amount"}]}.
  check_type: fel_pris | fel_paslag | ingar_i_avtal | ej_debiterbar | ata | saknar_underlag | ovrigt. Tom lista om inget hittas.

AVTALSDOKUMENT
${docs}

AVTALADE PRISER
${rates || '(inga)'}

VILLKOR
${clauses || '(inga)'}

REDAN HITTAT (beräknad kontroll)
${already || '(inget)'}

BILAGOR TILL FAKTUROR (arbetsbeskrivningar m.m.)
${docsText || '(inga)'}

FAKTURARADER (id | faktura | leverantör | datum | beskrivning | kostnadstyp | antal | enhet | à-pris för beställaren | belopp exkl. moms)
${table}`.slice(0, 240000);
}

function storeReview(db, projectId, raw) {
  const findings = (raw && Array.isArray(raw.findings) ? raw.findings : []).filter((f) => f && f.title);
  const validLines = new Set(db.prepare('SELECT id FROM line_items WHERE project_id = ?').all(projectId).map((r) => r.id));
  const out = [];
  findings.forEach((f, i) => {
    const ids = (Array.isArray(f.line_ids) ? f.line_ids : []).map(Number).filter((id) => validLines.has(id));
    const line = ids.length ? db.prepare('SELECT invoice_id FROM line_items WHERE id = ?').get(ids[0]) : null;
    out.push({ check_type: String(f.check_type || 'ovrigt'), severity: f.severity === 'info' ? 'info' : 'varning',
      invoice_id: line ? line.invoice_id : null, line_id: ids[0] || null, title: String(f.title),
      detail: String(f.detail || '') + (ids.length > 1 ? ` (rader: ${ids.join(', ')})` : ''),
      contract_ref: f.contract_ref ? String(f.contract_ref) : null,
      amount: typeof f.amount === 'number' && Number.isFinite(f.amount) ? f.amount : null,
      key: `${f.check_type}:${ids.join(',') || i}:${String(f.title).slice(0, 40)}` });
  });
  storeFindings(db, projectId, 'bedomning', out);
  db.prepare("INSERT INTO settings (key, value) VALUES (?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(`review_at:${projectId}`);
  return out.length;
}

module.exports = { runContractChecks, contractFor, matchRate, buildReviewPrompt, storeReview, REVIEW_SCHEMA };
