'use strict';
// Gör ett tolkningssvar säkert att spara även när det inte kommer via structured outputs
// (t.ex. via Claude-kontot): rätt typer, kända värden, saknade fält = null.
const { COST_CATEGORIES, TRADES, UNITS, INVOICE_KINDS, SUPPORT_TYPES } = require('./taxonomy');

const str = (v) => (v == null || v === '' ? null : String(v));
const num = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const date = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

function normalizeExtraction(raw) {
  const ex = raw && typeof raw === 'object' ? raw : {};
  const invoices = Array.isArray(ex.invoices) ? ex.invoices : [];
  return {
    summary: str(ex.summary) || '',
    warnings: Array.isArray(ex.warnings) ? ex.warnings.map(String) : [],
    invoices: invoices.map((inv, i) => ({
      ref: str(inv.ref) || `F${i + 1}`,
      kind: oneOf(inv.kind, INVOICE_KINDS, 'ovrigt'),
      parent_ref: str(inv.parent_ref),
      source_file: str(inv.source_file) || '',
      pages: str(inv.pages) || '',
      supplier_name: str(inv.supplier_name) || 'Okänd leverantör',
      supplier_orgnr: str(inv.supplier_orgnr),
      invoice_number: str(inv.invoice_number),
      invoice_date: date(inv.invoice_date),
      due_date: date(inv.due_date),
      period_start: date(inv.period_start),
      period_end: date(inv.period_end),
      project_label: str(inv.project_label),
      currency: str(inv.currency) || 'SEK',
      amount_excl_vat: num(inv.amount_excl_vat),
      vat_amount: num(inv.vat_amount),
      amount_incl_vat: num(inv.amount_incl_vat),
      reverse_charge_vat: Boolean(inv.reverse_charge_vat),
      lines: (Array.isArray(inv.lines) ? inv.lines : []).filter((l) => l && (l.description || l.amount_excl_vat != null)).map((l) => ({
        description: str(l.description) || '(utan beskrivning)',
        line_date: date(l.line_date),
        article_no: str(l.article_no),
        quantity: num(l.quantity),
        unit_raw: str(l.unit_raw),
        unit: l.unit == null ? null : oneOf(l.unit, UNITS, 'ovrigt'),
        unit_price: num(l.unit_price),
        amount_excl_vat: num(l.amount_excl_vat),
        cost_category: oneOf(l.cost_category, Object.keys(COST_CATEGORIES), 'ovrigt'),
        trade: l.trade == null ? null : oneOf(l.trade, Object.keys(TRADES), 'ovrigt'),
        resource_name: str(l.resource_name),
        material_type: str(l.material_type),
        attachment_ref: str(l.attachment_ref),
      })),
    })),
    supporting_documents: (Array.isArray(ex.supporting_documents) ? ex.supporting_documents : []).map((d) => ({
      source_file: str(d.source_file) || '',
      pages: str(d.pages) || '',
      doc_type: oneOf(d.doc_type, SUPPORT_TYPES, 'ovrigt'),
      title: str(d.title) || 'Bilaga',
      period_start: date(d.period_start),
      period_end: date(d.period_end),
      related_invoice_ref: str(d.related_invoice_ref),
      text_summary: str(d.text_summary) || '',
    })),
  };
}

module.exports = { normalizeExtraction };
