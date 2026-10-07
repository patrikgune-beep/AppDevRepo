'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kr = (n, d = 0) => (n == null ? '–' : Number(n).toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d }));
const kr2 = (n) => kr(n, 2);

const state = { meta: null, projects: [], projectId: null, submissionId: null, askHistory: [] };

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
const catName = (k) => (state.meta.categories[k] || k || '–');
const tradeName = (k) => (k ? state.meta.trades[k] || k : '');

// ---------- Flikar
$$('#tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
function showTab(name) {
  $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab').forEach((t) => t.classList.toggle('active', t.id === `tab-${name}`));
  if (name === 'analys') renderAnalysis();
  if (name === 'jamfor') initCompare();
  if (name === 'fraga') initAsk();
}

// ---------- Projekt
async function loadProjects() {
  state.projects = await api('/api/projects');
  $('#project-list').innerHTML = state.projects.map((p) => `
    <li data-id="${p.id}" class="${p.id === state.projectId ? 'active' : ''}">
      <span>${esc(p.name)}</span><span class="muted">${p.total ? kr(p.total) + ' kr' : ''}</span></li>`).join('')
    || '<li class="muted">Inga projekt ännu</li>';
  $$('#project-list li[data-id]').forEach((li) => li.addEventListener('click', () => selectProject(Number(li.dataset.id))));
}

$('#project-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const r = await api('/api/projects', { method: 'POST', body: JSON.stringify(Object.fromEntries(fd)) });
    e.target.reset();
    await loadProjects();
    selectProject(r.id);
  } catch (err) { alert(err.message); }
});

let pollTimer = null;
async function selectProject(id) {
  state.projectId = id;
  state.submissionId = null;
  await loadProjects();
  renderProject();
}

async function renderProject() {
  const p = state.projects.find((x) => x.id === state.projectId);
  if (!p) return;
  const subs = await api(`/api/projects/${p.id}/submissions`);
  const ai = state.meta.aiEnabled;
  $('#project-detail').innerHTML = `
    <div class="row" style="justify-content:space-between">
      <div><h2 style="margin:0">${esc(p.name)}</h2><div class="muted">${esc(p.description || '')}</div></div>
      <div style="text-align:right"><div class="muted">Kostnad exkl. moms</div><div class="kpi">${kr(p.total)} kr</div></div>
    </div>
    <form id="upload-form" class="drop" ${ai ? '' : 'hidden'}>
      <p><b>Ladda upp fakturaunderlag</b> – en stor PDF eller flera filer (faktura + bilagor) som hör ihop.</p>
      <div class="row" style="justify-content:center">
        <input type="file" name="files" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv" required>
        <input name="label" placeholder="Etikett (valfri), t.ex. Faktura sept">
        <button>Ladda upp &amp; tolka</button>
      </div>
      <p class="muted" style="margin:6px 0 0">Filer som laddas upp samtidigt tolkas tillsammans så att bilagor kopplas till rätt fakturarad.</p>
    </form>
    <h3>Underlag</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Uppladdat</th><th>Underlag</th><th>Status</th><th class="num">Kostnad</th><th></th></tr></thead>
      <tbody>${subs.map((s) => `
        <tr data-id="${s.id}">
          <td>${esc(s.uploaded_at.slice(0, 10))}</td>
          <td><a href="#" data-open="${s.id}">${esc(s.label || s.files || 'Underlag ' + s.id)}</a>
            ${s.summary ? `<div class="muted">${esc(s.summary)}</div>` : ''}
            ${s.error ? `<div class="tag warn">${esc(s.error)}</div>` : ''}</td>
          <td>${statusTag(s)}</td>
          <td class="num">${kr(s.total)}</td>
          <td class="row">${s.status === 'error' && ai ? `<button class="small" data-retry="${s.id}">Kör om</button>` : ''}
            <button class="small" data-del="${s.id}" title="Ta bort">✕</button></td>
        </tr>`).join('') || '<tr><td colspan="5" class="muted">Inga underlag ännu.</td></tr>'}
      </tbody></table></div>
    <div id="submission-detail"></div>
    <p><button class="ghost small" id="del-project">Ta bort projektet</button></p>`;

  const form = $('#upload-form');
  form.addEventListener('submit', onUpload);
  ['dragover', 'dragenter'].forEach((ev) => form.addEventListener(ev, (e) => { e.preventDefault(); form.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => form.addEventListener(ev, () => form.classList.remove('over')));
  form.addEventListener('drop', (e) => { e.preventDefault(); form.files.files = e.dataTransfer.files; });

  $$('[data-open]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); openSubmission(Number(a.dataset.open)); }));
  $$('[data-retry]').forEach((b) => b.addEventListener('click', async () => { await api(`/api/submissions/${b.dataset.retry}/retry`, { method: 'POST' }); renderProject(); }));
  $$('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Ta bort underlaget och all tolkad data?')) return;
    await api(`/api/submissions/${b.dataset.del}`, { method: 'DELETE' });
    await loadProjects(); renderProject();
  }));
  $('#del-project').addEventListener('click', async () => {
    if (!confirm(`Ta bort projektet ${p.name} med alla underlag?`)) return;
    await api(`/api/projects/${p.id}`, { method: 'DELETE' });
    state.projectId = null; await loadProjects();
    $('#project-detail').innerHTML = '<p class="muted">Välj eller skapa ett projekt.</p>';
  });

  clearTimeout(pollTimer);
  if (subs.some((s) => s.status === 'processing')) {
    pollTimer = setTimeout(async () => { await loadProjects(); renderProject(); }, 4000);
  }
  if (state.submissionId) openSubmission(state.submissionId);
}

function statusTag(s) {
  if (s.status === 'processing') return '<span class="spinner"></span> Tolkar…';
  if (s.status === 'error') return '<span class="tag warn">Fel</span>';
  if (s.status === 'done') return s.warnings ? `<span class="tag warn">${s.warnings} att kontrollera</span>` : '<span class="tag ok">Klar</span>';
  return esc(s.status);
}

async function onUpload(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const btn = $('button', e.target);
  btn.disabled = true;
  try {
    await api(`/api/projects/${state.projectId}/submissions`, { method: 'POST', body: fd });
    await renderProject();
  } catch (err) { alert(err.message); } finally { btn.disabled = false; }
}

async function openSubmission(id) {
  state.submissionId = id;
  const d = await api(`/api/submissions/${id}`);
  const byParent = new Map();
  d.invoices.forEach((i) => { const k = i.parent_invoice_id || 0; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k).push(i); });
  const ids = new Set(d.invoices.map((i) => i.id));
  const roots = d.invoices.filter((i) => !i.parent_invoice_id || !ids.has(i.parent_invoice_id));
  const renderInv = (inv, child) => `
    <div class="inv ${child ? 'child' : ''}">
      <div class="inv-head">
        <div><b>${esc(inv.supplier_name)}</b> · ${esc(kindName(inv.kind))} ${esc(inv.invoice_number || '')}
          <span class="muted">· ${esc(inv.invoice_date || '')} · sid ${esc(inv.pages || '')}</span>
          ${inv.is_duplicate ? '<span class="tag warn">Dubblett – räknas ej</span>' : ''}</div>
        <div>${kr2(inv.amount_excl_vat)} kr exkl. moms ${markupTag(inv)}</div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Beskrivning</th><th>Datum</th><th class="num">Antal</th><th>Enh</th><th class="num">À-pris</th>
          <th class="num">Belopp</th><th>Typ</th><th class="num">Kostnad beställare</th><th></th></tr></thead>
        <tbody>${inv.lines.map((l) => `
          <tr class="${l.counted ? '' : 'not-counted'}" title="${l.counted ? '' : 'Räknas via bilagans rader / dubblett'}">
            <td>${esc(l.description)}${l.resource_name ? ` <span class="muted">(${esc(l.resource_name)})</span>` : ''}</td>
            <td>${esc(l.line_date || '')}</td>
            <td class="num">${l.quantity == null ? '' : kr(l.quantity, 2)}</td>
            <td>${esc(l.unit || l.unit_raw || '')}</td>
            <td class="num">${kr2(l.unit_price)}</td>
            <td class="num">${kr2(l.amount_excl_vat)}</td>
            <td><span class="tag">${esc(catName(l.cost_category))}</span>
              ${l.trade ? `<span class="tag">${esc(tradeName(l.trade))}</span>` : ''}
              ${l.material_type ? `<span class="tag">${esc(l.material_type)}</span>` : ''}</td>
            <td class="num">${l.counted ? kr2(l.effective_amount) : ''}</td>
            <td><button class="small" data-edit='${esc(JSON.stringify(l))}'>✎</button></td>
          </tr>`).join('')}</tbody></table></div>
    </div>
    ${(byParent.get(inv.id) || []).map((c) => renderInv(c, true)).join('')}`;

  $('#submission-detail').innerHTML = `
    <div class="panel" style="margin-top:16px">
      <div class="row" style="justify-content:space-between"><h2 style="margin:0">${esc(d.submission.label || 'Underlag')}</h2>
        <button class="small" id="close-sub">Stäng</button></div>
      <p>${esc(d.submission.summary || '')}</p>
      <div class="row">${d.files.map((f) => `<a href="/api/files/${f.id}" target="_blank">📄 ${esc(f.original_name)}</a>`).join(' ')}</div>
      ${d.findings.map((f) => `<div class="finding ${f.severity}">${f.severity === 'varning' ? '⚠️' : 'ℹ️'} ${esc(f.message)}</div>`).join('')}
      ${roots.map((r) => renderInv(r, false)).join('')}
      ${d.supporting.length ? `<h3>Bilagor utan belopp</h3>${d.supporting.map((s) => `
        <div class="inv"><b>${esc(s.title)}</b> <span class="muted">· ${esc(s.doc_type)} · sid ${esc(s.pages)}</span>
        <div>${esc(s.text_summary)}</div></div>`).join('')}` : ''}
    </div>`;
  $('#close-sub').addEventListener('click', () => { state.submissionId = null; $('#submission-detail').innerHTML = ''; });
  $$('[data-edit]').forEach((b) => b.addEventListener('click', () => editLine(JSON.parse(b.dataset.edit))));
}

const kindName = (k) => ({ huvudfaktura: 'Faktura', underleverantorsfaktura: 'Bilaga (UE/leverantör)', kvitto: 'Kvitto', kreditfaktura: 'Kreditfaktura' }[k] || k);
function markupTag(inv) {
  if (inv.markup_status === 'ok') return `<span class="tag ok">vidarefakturerat ${kr2(inv.billed_amount)} (påslag ${((inv.billed_ratio - 1) * 100).toFixed(1)} %)</span>`;
  if (inv.markup_status === 'avvikelse') return `<span class="tag warn">vidarefakturerat ${kr2(inv.billed_amount)} – avviker</span>`;
  if (inv.markup_status === 'saknar_rad') return '<span class="tag warn">ej vidarefakturerad</span>';
  return '';
}

function editLine(l) {
  const dlg = $('#line-dialog');
  const f = $('#line-form');
  $('#line-desc').textContent = l.description;
  f.cost_category.innerHTML = Object.entries(state.meta.categories).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  f.trade.innerHTML = '<option value="">–</option>' + Object.entries(state.meta.trades).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  f.cost_category.value = l.cost_category; f.trade.value = l.trade || ''; f.material_type.value = l.material_type || ''; f.unit.value = l.unit || '';
  dlg.returnValue = '';
  dlg.showModal();
  dlg.onclose = async () => {
    if (dlg.returnValue !== 'save') return;
    try {
      await api(`/api/lines/${l.id}`, { method: 'PATCH', body: JSON.stringify({
        cost_category: f.cost_category.value, trade: f.trade.value, material_type: f.material_type.value, unit: f.unit.value,
      }) });
      openSubmission(state.submissionId);
    } catch (err) { alert(err.message); }
  };
}

// ---------- Gemensamma filter (analys + fråga)
async function filterControls(container, onChange) {
  const dims = await api('/api/analysis/dimensions');
  container.innerHTML = `
    <label>Projekt <select name="projects" multiple size="3">${state.projects.map((p) => `<option value="${p.id}" ${p.id === state.projectId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
    <label>Från månad <select name="from"><option value="">–</option>${dims.months.map((m) => `<option>${m}</option>`).join('')}</select></label>
    <label>Till månad <select name="to"><option value="">–</option>${dims.months.map((m) => `<option>${m}</option>`).join('')}</select></label>
    <label>Månad avser <select name="monthBasis"><option value="work">När arbetet utfördes</option><option value="invoice">Fakturadatum</option></select></label>
    <label>Leverantör <select name="supplier"><option value="">Alla</option>${dims.suppliers.map((s) => `<option>${esc(s)}</option>`).join('')}</select></label>
    <label>Kostnadstyp <select name="category"><option value="">Alla</option>${Object.entries(state.meta.categories).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
    <span class="muted" style="font-size:12px">Inga projekt markerade = alla projekt</span>`;
  $$('select', container).forEach((s) => s.addEventListener('change', onChange));
}
function readFilters(container) {
  const g = (n) => $(`[name=${n}]`, container);
  return {
    projectIds: [...g('projects').selectedOptions].map((o) => Number(o.value)),
    from: g('from').value, to: g('to').value, monthBasis: g('monthBasis').value,
    supplier: g('supplier').value, category: g('category').value,
  };
}
const toQuery = (f) => new URLSearchParams({ projects: f.projectIds.join(','), from: f.from || '', to: f.to || '',
  monthBasis: f.monthBasis || 'work', supplier: f.supplier || '', category: f.category || '' }).toString();

// ---------- Analys
let analysisInit = false;
async function renderAnalysis() {
  const fc = $('#analys-filters');
  if (!analysisInit) { await filterControls(fc, renderAnalysis); analysisInit = true; }
  const f = readFilters(fc);
  const q = toQuery(f);
  const [o, findings, lines] = await Promise.all([
    api(`/api/analysis/overview?${q}`), api(`/api/findings?projects=${f.projectIds.join(',')}`), api(`/api/analysis/lines?${q}`),
  ]);
  const bars = (rows, label = (r) => esc(r.key || '–')) => {
    const max = Math.max(...rows.map((r) => r.amount || 0), 1);
    return `<table><tbody>${rows.map((r) => `<tr><td>${label(r)}</td><td style="width:40%"><div class="bar" style="width:${(100 * (r.amount || 0)) / max}%"></div></td><td class="num">${kr(r.amount)} kr</td></tr>`).join('')}</tbody></table>`;
  };
  $('#analys-out').innerHTML = `
    <div class="grid">
      <div class="panel"><div class="muted">Kostnad exkl. moms (inkl. påslag)</div><div class="kpi">${kr(o.total.total)} kr</div>
        <div class="muted">${o.total.lines} kostnadsrader</div></div>
      <div class="panel"><h3 style="margin-top:0">Per kostnadstyp</h3>${bars(o.byCategory, (r) => esc(catName(r.key)))}</div>
      <div class="panel"><h3 style="margin-top:0">Per leverantör (utförare)</h3>${bars(o.bySupplier)}</div>
      <div class="panel"><h3 style="margin-top:0">Per månad</h3>${bars(o.byMonth)}</div>
      <div class="panel"><h3 style="margin-top:0">Timmar per yrke</h3><table><thead><tr><th>Yrke</th><th class="num">Timmar*</th><th class="num">Kostnad</th><th class="num">Snitt kr/h</th></tr></thead>
        <tbody>${o.byTrade.map((r) => `<tr><td>${esc(tradeName(r.key))}</td><td class="num">${kr(r.hours, 1)}</td><td class="num">${kr(r.amount)}</td><td class="num">${kr(r.avg_price)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Inga timmar</td></tr>'}</tbody></table>
        <p class="muted" style="font-size:12px">*Antal på rader med yrke (normalt timmar).</p></div>
      <div class="panel"><h3 style="margin-top:0">Att kontrollera</h3>${findings.map((x) => `<div class="finding ${x.severity}">${esc(x.project_name)}: ${esc(x.message)}</div>`).join('') || '<p class="muted">Inget.</p>'}</div>
    </div>
    <div class="panel"><details><summary>Visa alla ${lines.length} kostnadsrader</summary>
      <div class="table-wrap"><table><thead><tr><th>Projekt</th><th>Månad</th><th>Leverantör</th><th>Beskrivning</th><th>Typ</th><th class="num">Antal</th><th>Enh</th><th class="num">À-pris lev.</th><th class="num">À-pris beställare</th><th class="num">Kostnad</th></tr></thead>
      <tbody>${lines.map((l) => `<tr><td>${esc(l.project_name)}</td><td>${esc(f.monthBasis === 'invoice' ? l.invoice_month : l.work_month)}</td><td>${esc(l.supplier_name)}</td><td>${esc(l.description)}</td><td>${esc(catName(l.cost_category))}${l.trade ? ' · ' + esc(tradeName(l.trade)) : ''}</td><td class="num">${l.quantity == null ? '' : kr(l.quantity, 2)}</td><td>${esc(l.unit || '')}</td><td class="num">${kr2(l.unit_price)}</td><td class="num">${kr2(l.effective_unit_price)}${l.markup_assumed ? '*' : ''}</td><td class="num">${kr2(l.effective_amount)}</td></tr>`).join('')}</tbody></table></div>
      <p class="muted" style="font-size:12px">* À-pris med antaget påslag (bilagan avviker från fakturerat belopp).</p></details></div>`;
}

// ---------- Jämför
let cmpDims = null;
async function initCompare() {
  cmpDims = await api('/api/analysis/dimensions');
  $('#cmp-projects').innerHTML = state.projects.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  fillCmpValues();
}
function fillCmpValues() {
  const dim = $('#cmp-dim').value;
  const rows = dim === 'trade' ? cmpDims.trades : cmpDims.materials;
  $('#cmp-value').innerHTML = rows.map((r) => `<option value="${esc(r.value)}|${esc(r.unit || '')}">${esc(dim === 'trade' ? tradeName(r.value) : r.value)} (${esc(r.unit || '?')}) – ${r.projects} proj.</option>`).join('')
    || '<option value="">Inga värden ännu</option>';
}
$('#cmp-dim').addEventListener('change', fillCmpValues);
$('#cmp-run').addEventListener('click', async () => {
  const [value, unit] = $('#cmp-value').value.split('|');
  if (!value) return;
  const projects = [...$('#cmp-projects').selectedOptions].map((o) => o.value).join(',');
  const r = await api(`/api/analysis/compare?${new URLSearchParams({ dimension: $('#cmp-dim').value, value, unit, projects })}`);
  const label = $('#cmp-dim').value === 'trade' ? tradeName(value) : value;
  const row = (name, x) => `<tr><td>${esc(name)}</td><td class="num">${kr2(x.avg_price)}</td><td class="num">${kr2(x.min_price)}</td><td class="num">${kr2(x.max_price)}</td><td class="num">${kr2(x.avg_supplier_price)}</td><td class="num">${kr(x.quantity, 1)}</td><td class="num">${x.lines}</td><td>${esc(x.suppliers || '')}${x.has_assumed_markup ? ' <span class="tag warn">antaget påslag</span>' : ''}</td></tr>`;
  $('#cmp-out').innerHTML = `<div class="panel"><h3 style="margin-top:0">${esc(label)} – kr per ${esc(unit || 'enhet')} exkl. moms</h3>
    <div class="table-wrap"><table><thead><tr><th>Projekt</th><th class="num">Medel (viktat)</th><th class="num">Lägst</th><th class="num">Högst</th><th class="num">Leverantörens pris</th><th class="num">Mängd</th><th class="num">Rader</th><th>Leverantörer</th></tr></thead>
    <tbody>${r.perProject.map((p) => row(p.project_name, p)).join('')}</tbody>
    <tfoot>${r.perProject.length > 1 ? row('Alla valda projekt', r.overall) : ''}</tfoot></table></div>
    ${r.perProject.length < 2 ? '<p class="muted">Bara ett projekt har data för detta – ladda upp fler projekt för en jämförelse.</p>' : ''}</div>`;
});

// ---------- Fråga
let askInit = false;
const EXAMPLES = [
  'Vad kostar elektriker per timme i respektive projekt? Ange medel, högst och lägst.',
  'Vad kostar betong per m3 i de olika projekten?',
  'Sammanställ kostnaderna per leverantör och kostnadstyp för vald period.',
  'Hur stort påslag tar entreprenören på underentreprenörer och material?',
  'Vilka timmar har fakturerats för rivning och vad gjordes enligt arbetsbeskrivningarna?',
  'Finns det något i underlaget som bör kontrolleras innan betalning?',
];
async function initAsk() {
  if (askInit) return;
  askInit = true;
  await filterControls($('#ask-filters'), () => {});
  $('#ask-examples').innerHTML = EXAMPLES.map((e) => `<button class="ghost" type="button">${esc(e)}</button>`).join('');
  $$('#ask-examples button').forEach((b) => b.addEventListener('click', () => { $('#ask-q').value = b.textContent; }));
  if (!state.meta.aiEnabled) { $('#ask-btn').disabled = true; }
}
$('#ask-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = $('#ask-q').value.trim();
  if (!question) return;
  const scope = readFilters($('#ask-filters'));
  const box = document.createElement('div');
  box.className = 'panel';
  box.innerHTML = `<b>${esc(question)}</b><div class="answer"><span class="spinner"></span> Analyserar…</div>`;
  $('#ask-log').prepend(box);
  $('#ask-btn').disabled = true;
  try {
    const r = await api('/api/ask', { method: 'POST', body: JSON.stringify({ question, scope, history: state.askHistory }) });
    state.askHistory.push({ role: 'user', content: question }, { role: 'assistant', content: r.answer });
    $('.answer', box).innerHTML = markdown(r.answer) + (r.queries.length ? `<details><summary>Visa ${r.queries.length} databasfrågor bakom svaret</summary>${r.queries.map((q) => `<p><b>${esc(q.purpose)}</b> ${q.error ? `<span class="tag warn">${esc(q.error)}</span>` : `<span class="muted">(${q.rows} rader)</span>`}</p><pre>${esc(q.sql)}</pre>`).join('')}</details>` : '');
  } catch (err) {
    $('.answer', box).innerHTML = `<span class="tag warn">${esc(err.message)}</span>`;
  } finally { $('#ask-btn').disabled = false; }
});

// Enkel och säker Markdown (rubriker, fetstil, listor, tabeller)
function markdown(md) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
  const out = [];
  const lines = String(md || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*\|/.test(l)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      i--;
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const body = rows.filter((r, k) => !(k === 1 && /^[\s|:-]+$/.test(r)));
      out.push(`<div class="table-wrap"><table><thead><tr>${cells(body[0]).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.slice(1).map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    } else if (/^#{1,4} /.test(l)) out.push(`<h3>${inline(l.replace(/^#+ /, ''))}</h3>`);
    else if (/^\s*[-*] /.test(l)) {
      const items = [];
      while (i < lines.length && /^\s*[-*] /.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*] /, ''));
      i--;
      out.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`);
    } else if (l.trim()) out.push(`<p>${inline(l)}</p>`);
  }
  return out.join('');
}

// ---------- Start
(async function init() {
  state.meta = await api('/api/meta');
  $('#ai-banner').hidden = state.meta.aiEnabled;
  await loadProjects();
  if (state.projects[0]) selectProject(state.projects[0].id);
})();
