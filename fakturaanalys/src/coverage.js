'use strict';
// Kontroll av att hela underlaget blev tolkat, och koppling av bilagor till rätt rad på
// huvudfakturan när tolkningen missat den kopplingen.

// "3", "5-6", "1–2, 4", "sida 7" -> [3, 5, 6, ...]
function parsePages(s) {
  const out = new Set();
  for (const m of String(s || '').matchAll(/(\d+)\s*(?:[-–]\s*(\d+))?/g)) {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let n = Math.min(a, b); n <= Math.max(a, b) && n - Math.min(a, b) < 500; n++) out.add(n);
  }
  return [...out];
}

const base = (name) => String(name || '').split('/').pop().toLowerCase().trim();

// Vilka sidor (per fil) som någon faktura, bilaga eller medvetet överhoppad sida täcker.
function coveredPages(ex, fileNames) {
  const covered = new Map(fileNames.map((f) => [f, new Set()]));
  const resolveFile = (src) => {
    if (fileNames.length === 1) return fileNames[0];
    const b = base(src);
    return fileNames.find((f) => base(f) === b) || fileNames.find((f) => b && (base(f).includes(b) || b.includes(base(f)))) || null;
  };
  const mark = (src, pages) => {
    const f = resolveFile(src);
    if (f) for (const n of parsePages(pages)) covered.get(f).add(n);
  };
  for (const inv of ex.invoices || []) mark(inv.source_file, inv.pages);
  for (const d of ex.supporting_documents || []) mark(d.source_file, d.pages);
  for (const p of ex.ignored_pages || []) mark(p.source_file, String(p.page));
  return covered;
}

const digits = (s) => String(s || '').replace(/\D/g, '');
const words = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter((w) => w.length >= 4);
const GENERIC = new Set(['byggmaterial', 'sweden', 'sverige', 'bygg', 'faktura', 'recycling', 'entreprenad', 'byggentreprenad']);

/**
 * Kopplar bilagor (underleverantörsfakturor, kvitton) som ingen rad på huvudfakturan pekar på.
 * Matchar i första hand på fakturanummer i radtexten, annars på leverantörens namn.
 * Ändrar ex på plats och returnerar antalet nya kopplingar.
 */
function linkAttachments(ex) {
  const invoices = ex.invoices || [];
  const mains = invoices.filter((i) => i.kind === 'huvudfaktura');
  if (!mains.length) return 0;
  const referenced = new Set(mains.flatMap((m) => m.lines.map((l) => l.attachment_ref).filter(Boolean)));
  const freeLines = () => mains.flatMap((m) => m.lines.filter((l) => !l.attachment_ref && l.amount_excl_vat != null).map((l) => ({ m, l })));
  let linked = 0;
  for (const att of invoices) {
    if (att.kind === 'huvudfaktura' || referenced.has(att.ref)) continue;
    const no = digits(att.invoice_number);
    let hit = no.length >= 4 ? freeLines().filter(({ l }) => digits(l.description).includes(no)) : [];
    if (hit.length !== 1) {
      const names = words(att.supplier_name).filter((w) => !GENERIC.has(w));
      hit = names.length ? freeLines().filter(({ l }) => names.some((w) => words(l.description).includes(w))) : [];
    }
    if (hit.length === 1) {
      hit[0].l.attachment_ref = att.ref;
      if (!att.parent_ref) att.parent_ref = hit[0].m.ref;
      if (att.kind === 'ovrigt') att.kind = 'underleverantorsfaktura';
      referenced.add(att.ref);
      linked++;
    }
  }
  return linked;
}

// Lägger till resultatet från en kompletterande tolkning. Nya ref byts ut så att de inte
// krockar med de befintliga; referenser till befintliga fakturor behålls.
function mergeExtraction(target, extra, prefix) {
  const existing = new Set((target.invoices || []).map((i) => i.ref));
  const map = new Map();
  for (const inv of extra.invoices || []) {
    let ref = `${prefix}${inv.ref}`;
    while (existing.has(ref)) ref += '_';
    map.set(inv.ref, ref);
    existing.add(ref);
  }
  const remap = (r) => (r == null ? r : map.get(r) || r);
  for (const inv of extra.invoices || []) {
    target.invoices.push({
      ...inv, ref: map.get(inv.ref), parent_ref: remap(inv.parent_ref),
      lines: inv.lines.map((l) => ({ ...l, attachment_ref: remap(l.attachment_ref) })),
    });
  }
  for (const d of extra.supporting_documents || []) {
    target.supporting_documents.push({ ...d, related_invoice_ref: remap(d.related_invoice_ref) });
  }
  target.ignored_pages = [...(target.ignored_pages || []), ...(extra.ignored_pages || [])];
  target.warnings.push(...(extra.warnings || []));
  return target;
}

module.exports = { parsePages, coveredPages, linkAttachments, mergeExtraction };
