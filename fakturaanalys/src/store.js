'use strict';
// Sparar tolkat underlag och stämmer av huvudfaktura mot bilagor så att
// varje krona räknas exakt en gång och påslag synliggörs.
const { tx } = require('./schema');
const { COST_CATEGORIES, TRADES } = require('./taxonomy');
const { isReinvoiceLine, vendorFromDescription } = require('./coverage');

// Leverantören på en vidarefakturerad klumprad ("HARD WORKERS OF SWEDEN AB, 33849") när bilagan saknas.
// Matchas mot leverantörer som redan finns i projektet så att namnet blir detsamma ("Hard Workers of Sweden AB").
const nameWords = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/)
  .filter((w) => w.length >= 4 && !['sweden', 'sverige', 'bygg', 'byggmaterial', 'aktiebolag'].includes(w));
function vendorForLine(l, inv, knownSuppliers) {
  if (inv.parent_invoice_id || l.attachment_invoice_id) return null;
  if (!isReinvoiceLine({ ...l, attachment_ref: null })) return null;
  const parsed = vendorFromDescription(l.description);
  if (!parsed) return null;
  const pw = nameWords(parsed);
  const known = knownSuppliers.find((k) => k !== inv.supplier_name && nameWords(k).some((w) => pw.includes(w)));
  return known || parsed;
}

const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100);
const month = (d) => (typeof d === 'string' && /^\d{4}-\d{2}/.test(d) ? d.slice(0, 7) : null);
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9åäö]/g, '');
const fmt = (n) => (n == null ? '–' : n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

// Ett vidarefakturerat belopp inom detta intervall tolkas som påslag (0–50 %).
const MARKUP_MIN = 0.999;
const MARKUP_MAX = 1.5;

function saveExtraction(db, submissionId, projectId, ex) {
  return tx(db, () => {
    const addFinding = db.prepare(
      'INSERT INTO findings (submission_id, project_id, invoice_id, severity, source, message) VALUES (?,?,?,?,?,?)');
    const insInv = db.prepare(`INSERT INTO invoices (submission_id, project_id, ref, kind, source_file, pages,
      supplier_name, supplier_orgnr, invoice_number, invoice_date, due_date, period_start, period_end, project_label,
      currency, amount_excl_vat, vat_amount, amount_incl_vat, reverse_charge_vat, is_duplicate)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const existing = db.prepare(`SELECT id, supplier_name, supplier_orgnr FROM invoices
      WHERE project_id = ? AND submission_id <> ? AND invoice_number = ? AND is_duplicate = 0`);

    const idByRef = new Map();
    for (const inv of ex.invoices || []) {
      let dup = 0;
      if (inv.invoice_number) {
        dup = existing.all(projectId, submissionId, inv.invoice_number).some((e) =>
          (inv.supplier_orgnr && norm(e.supplier_orgnr) === norm(inv.supplier_orgnr)) ||
          norm(e.supplier_name) === norm(inv.supplier_name)) ? 1 : 0;
      }
      const r = insInv.run(submissionId, projectId, inv.ref, inv.kind, inv.source_file, inv.pages,
        inv.supplier_name, inv.supplier_orgnr, inv.invoice_number, inv.invoice_date, inv.due_date,
        inv.period_start, inv.period_end, inv.project_label, inv.currency || 'SEK',
        inv.amount_excl_vat, inv.vat_amount, inv.amount_incl_vat, inv.reverse_charge_vat ? 1 : 0, dup);
      const id = Number(r.lastInsertRowid);
      idByRef.set(inv.ref, id);
      if (dup) {
        addFinding.run(submissionId, projectId, id, 'varning', 'tolkning',
          `Faktura ${inv.invoice_number} från ${inv.supplier_name} finns redan i projektet. ` +
          'Den räknas inte igen (dubblett).');
      }
    }

    const setParent = db.prepare('UPDATE invoices SET parent_invoice_id = ? WHERE id = ?');
    const insLine = db.prepare(`INSERT INTO line_items (invoice_id, project_id, line_no, description, line_date,
      article_no, quantity, unit, unit_raw, unit_price, amount_excl_vat, cost_category, trade, resource_name,
      material_type, attachment_invoice_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

    for (const inv of ex.invoices || []) {
      const id = idByRef.get(inv.ref);
      if (inv.parent_ref && idByRef.has(inv.parent_ref)) setParent.run(idByRef.get(inv.parent_ref), id);
      let sum = 0;
      (inv.lines || []).forEach((l, i) => {
        const category = COST_CATEGORIES[l.cost_category] ? l.cost_category : 'ovrigt';
        const trade = l.trade && TRADES[l.trade] ? l.trade : null;
        const attId = l.attachment_ref && idByRef.has(l.attachment_ref) ? idByRef.get(l.attachment_ref) : null;
        insLine.run(id, projectId, i + 1, l.description, l.line_date, l.article_no, l.quantity, l.unit,
          l.unit_raw, l.unit_price, l.amount_excl_vat, category, trade, l.resource_name,
          l.material_type ? l.material_type.toLowerCase().trim() : null, attId);
        sum += l.amount_excl_vat || 0;
      });
      if (inv.amount_excl_vat != null && inv.lines && inv.lines.length &&
          Math.abs(sum - inv.amount_excl_vat) > 1.0) {
        addFinding.run(submissionId, projectId, id, 'varning', 'tolkning',
          `${inv.supplier_name} ${inv.invoice_number || ''}: radernas summa ${fmt(sum)} kr stämmer inte med ` +
          `fakturans belopp exkl. moms ${fmt(inv.amount_excl_vat)} kr.`);
      }
    }

    const insDoc = db.prepare(`INSERT INTO supporting_docs (submission_id, project_id, invoice_id, doc_type, title,
      source_file, pages, period_start, period_end, text_summary) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    for (const d of ex.supporting_documents || []) {
      insDoc.run(submissionId, projectId, idByRef.get(d.related_invoice_ref) ?? null, d.doc_type, d.title,
        d.source_file, d.pages, d.period_start, d.period_end, d.text_summary);
    }
    for (const w of ex.warnings || []) addFinding.run(submissionId, projectId, null, 'varning', 'tolkning', w);

    db.prepare("UPDATE submissions SET summary = ?, read_log = ?, status = 'done', processed_at = datetime('now'), error = NULL WHERE id = ?")
      .run(ex.summary || null, ex.read_log ? JSON.stringify(ex.read_log) : null, submissionId);
  });
}

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Räknar om härledda fält för ett projekt. Körs efter varje uppladdning och manuell ändring.
function reconcile(db, projectId) {
  return tx(db, () => {
    const invoices = db.prepare('SELECT * FROM invoices WHERE project_id = ?').all(projectId);
    const lines = db.prepare('SELECT * FROM line_items WHERE project_id = ?').all(projectId);
    const invById = new Map(invoices.map((i) => [i.id, i]));
    const linesByInv = new Map();
    for (const l of lines) {
      if (!linesByInv.has(l.invoice_id)) linesByInv.set(l.invoice_id, []);
      linesByInv.get(l.invoice_id).push(l);
    }
    const billingLine = new Map(); // bilagans id -> raden på huvudfakturan
    for (const l of lines) if (l.attachment_invoice_id) billingLine.set(l.attachment_invoice_id, l);

    const topOf = (inv) => {
      let cur = inv;
      const seen = new Set();
      while (cur.parent_invoice_id && invById.has(cur.parent_invoice_id) && !seen.has(cur.id)) {
        seen.add(cur.id);
        cur = invById.get(cur.parent_invoice_id);
      }
      return cur;
    };

    // 1. Avstämning bilaga <-> fakturerad rad
    const recon = new Map();
    for (const inv of invoices) {
      const bl = billingLine.get(inv.id);
      const own = linesByInv.get(inv.id) || [];
      const base = inv.amount_excl_vat ?? own.reduce((s, l) => s + (l.amount_excl_vat || 0), 0);
      if (bl) {
        const billed = bl.amount_excl_vat;
        const ratio = billed != null && base ? billed / base : null;
        const status = ratio != null && ratio >= MARKUP_MIN && ratio <= MARKUP_MAX ? 'ok' : 'avvikelse';
        recon.set(inv.id, { billed, ratio, status, base });
      } else if (inv.parent_invoice_id) {
        recon.set(inv.id, { billed: null, ratio: null, status: 'saknar_rad', base });
      } else {
        recon.set(inv.id, { billed: null, ratio: null, status: 'ej_tillampligt', base });
      }
    }
    const okRatios = [...recon.values()].filter((r) => r.status === 'ok').map((r) => r.ratio);
    const defaultMarkup = median(okRatios) ?? 1;

    db.prepare("DELETE FROM findings WHERE project_id = ? AND source = 'avstamning'").run(projectId);
    const addFinding = db.prepare(
      "INSERT INTO findings (submission_id, project_id, invoice_id, severity, source, message) VALUES (?,?,?,?,'avstamning',?)");
    const updInv = db.prepare('UPDATE invoices SET billed_amount = ?, billed_ratio = ?, markup_status = ? WHERE id = ?');
    for (const inv of invoices) {
      const r = recon.get(inv.id);
      updInv.run(round2(r.billed), r.ratio == null ? null : Math.round(r.ratio * 10000) / 10000, r.status, inv.id);
      const name = `${inv.supplier_name} ${inv.invoice_number || ''}`.trim();
      if (r.status === 'ok' && r.ratio > 1.0005) {
        addFinding.run(inv.submission_id, projectId, inv.id, 'info',
          `${name}: ${fmt(r.base)} kr vidarefakturerat som ${fmt(r.billed)} kr = påslag ${((r.ratio - 1) * 100).toFixed(1).replace('.', ',')} %.`);
      } else if (r.status === 'avvikelse') {
        addFinding.run(inv.submission_id, projectId, inv.id, 'varning',
          `${name}: bilagan är ${fmt(r.base)} kr exkl. moms men vidarefakturerat belopp är ${fmt(r.billed)} kr ` +
          `(${r.ratio == null ? '?' : (r.ratio * 100).toFixed(1).replace('.', ',')} %). Kontrollera om fakturan delats mellan ` +
          `projekt eller om något saknas. À-priser räknas med antaget påslag ${((defaultMarkup - 1) * 100).toFixed(1).replace('.', ',')} %.`);
      } else if (r.status === 'saknar_rad' && !inv.is_duplicate) {
        addFinding.run(inv.submission_id, projectId, inv.id, 'varning',
          `${name}: bilagan hittades inte som rad på huvudfakturan och räknas därför inte som kostnad.`);
      }
    }

    // 2. Härledda fält per rad
    const knownSuppliers = [...new Set(invoices.map((i) => i.supplier_name).filter(Boolean))];
    const updLine = db.prepare(`UPDATE line_items SET counted = ?, alloc_factor = ?, markup_factor = ?,
      markup_assumed = ?, effective_amount = ?, effective_unit_price = ?, work_month = ?, invoice_month = ?,
      supplier_name = ?, billed_by = ? WHERE id = ?`);
    for (const l of lines) {
      const inv = invById.get(l.invoice_id);
      const top = topOf(inv);
      const r = recon.get(inv.id);
      const att = l.attachment_invoice_id ? invById.get(l.attachment_invoice_id) : null;
      const attHasLines = att && (linesByInv.get(att.id) || []).length > 0 && !att.is_duplicate;

      let counted = 1;
      let alloc = 1;
      let markup = 1;
      let assumed = 0;
      if (inv.is_duplicate || top.is_duplicate) counted = 0;
      else if (attHasLines) counted = 0; // ersätts av bilagans detaljrader
      else if (r.status === 'saknar_rad') counted = 0;
      else if (r.status === 'ok') { alloc = r.ratio; markup = r.ratio; }
      else if (r.status === 'avvikelse') { alloc = r.ratio ?? 0; markup = defaultMarkup; assumed = 1; }

      const effAmount = l.amount_excl_vat == null ? null : round2(l.amount_excl_vat * alloc);
      let effUnit = null;
      if (l.unit_price != null) effUnit = round2(l.unit_price * markup);
      else if (l.amount_excl_vat != null && l.quantity) effUnit = round2((l.amount_excl_vat / l.quantity) * markup);

      const vendor = counted ? vendorForLine(l, inv, knownSuppliers) : null;
      const workMonth = month(l.line_date) || month(inv.period_start) || month(inv.invoice_date) ||
        month(top.period_start) || month(top.invoice_date);
      updLine.run(counted, alloc, markup, assumed, effAmount, effUnit, workMonth, month(top.invoice_date),
        vendor || inv.supplier_name, top.supplier_name, l.id);
    }
  });
}

module.exports = { saveExtraction, reconcile };
