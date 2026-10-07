'use strict';
const { renderPdfImages } = require('../src/pdf-pages');
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kr = (n, d = 0) => (n == null ? '–' : Number(n).toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d }));
const kr2 = (n) => kr(n, 2);

// Egna dialogrutor: confirm()/alert() fungerar inte överallt (t.ex. när appen öppnas via Claude).
function confirmBox(message, okLabel = 'Ta bort') {
  const dlg = $('#confirm-dialog');
  $('#confirm-text').textContent = message;
  $('#confirm-ok').textContent = okLabel;
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((resolve) => { dlg.onclose = () => resolve(dlg.returnValue === 'ok'); });
}
function notify(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(notify.t);
  notify.t = setTimeout(() => { el.hidden = true; }, 6000);
}

const state = { meta: null, projects: [], projectId: null, submissionId: null, askHistory: [] };

// Allt körs på enheten: anropen går till den lokala motorn (src/local-api.js), inte till en server.
let api = async () => { throw new Error('Appen startar…'); };
function setApi(fn) { api = fn; }

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
  if (name === 'installningar') renderSettings();
}

// ---------- Projekt
async function loadProjects() {
  state.projects = await api('/api/projects');
  $('#project-list').innerHTML = state.projects.map((p) => `
    <li data-id="${p.id}" class="${p.id === state.projectId ? 'active' : ''}">
      <span>${p.folder_path != null ? '📁 ' : ''}${esc(p.name)}</span><span class="muted">${p.total ? kr(p.total) + ' kr' : ''}</span></li>`).join('')
    || '<li class="muted">Inga projekt ännu</li>';
  $$('#project-list li[data-id]').forEach((li) => li.addEventListener('click', () => selectProject(Number(li.dataset.id))));
  $('#sync-all').hidden = !state.meta.aiEnabled || state.meta.folderMode === 'none' || !state.projects.some((p) => p.folder_path != null);
}

$('#project-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const r = await api('/api/projects', { method: 'POST', body: JSON.stringify(Object.fromEntries(fd)) });
    e.target.reset();
    await loadProjects();
    selectProject(r.id);
  } catch (err) { notify(err.message); }
});

let pollTimer = null;
async function selectProject(id) {
  state.projectId = id;
  state.submissionId = null;
  await loadProjects();
  await renderProject();
  if (window.innerWidth < 700) $('#project-detail').scrollIntoView({ behavior: 'smooth' });
}

async function renderProject() {
  const p = state.projects.find((x) => x.id === state.projectId);
  if (!p) return;
  const subs = await api(`/api/projects/${p.id}/submissions`);
  const ai = state.meta.aiEnabled;
  const fm = state.meta.folderMode;
  const folderBox = fm === 'none'
    ? `<p class="muted">Den här webbläsaren kan inte komma ihåg en mapp. Installera iOS-appen för att välja en mapp i Filer en gång och sedan bara trycka Uppdatera – eller välj filerna nedan.</p>`
    : p.folder_path != null
      ? `<p><b>${esc(p.folder_path)}</b><br>
         <span class="muted">${p.last_synced_at ? 'Senast uppdaterad ' + esc(fmtTime(p.last_synced_at)) : 'Inte uppdaterad ännu'}</span></p>
         <div class="row"><button id="sync-btn" type="button">⟳ Uppdatera</button>
           <button id="pick-folder" type="button" class="ghost">Byt mapp</button>
           <button id="forget-folder" type="button" class="ghost small">Koppla bort</button></div>`
      : `<p class="muted">Välj mappen där fakturorna för projektet ligger (t.ex. i iCloud Drive eller på datorn). Lägg nya fakturor där och tryck Uppdatera.</p>
         <button id="pick-folder" type="button">Välj mapp…</button>`;

  $('#project-detail').innerHTML = `
    <div class="row" style="justify-content:space-between">
      <div><h2 style="margin:0">${esc(p.name)}</h2><div class="muted">${esc(p.description || '')}</div></div>
      <div style="text-align:right"><div class="muted">Kostnad exkl. moms</div><div class="kpi">${kr(p.total)} kr</div></div>
    </div>
    ${ai ? '' : '<p class="finding varning">Ange din API-nyckel under ⚙︎ Inställningar för att kunna läsa in fakturor.</p>'}
    <div class="sources" ${ai ? '' : 'hidden'}>
      <div class="source">
        <h3>📁 Fakturamapp</h3>
        ${folderBox}
        <p class="muted small">Filer i en undermapp tolkas tillsammans (faktura + bilagor). Filer direkt i mappen tolkas var för sig. Lägg kontrakt, offert och kontraktsbilagor i en undermapp som heter t.ex. "Avtal". Redan inlästa filer hoppas över.</p>
      </div>
      <form id="upload-form" class="source">
        <h3>📄 Välj filer</h3>
        <input type="file" name="files" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,application/pdf,image/*">
        <div class="seg" role="radiogroup" aria-label="Typ av underlag">
          <label><input type="radio" name="kind" value="faktura" checked><span>Fakturor</span></label>
          <label><input type="radio" name="kind" value="avtal"><span>Avtal: kontrakt, offert, bilagor</span></label>
        </div>
        <div class="row radios">
          <label><input type="radio" name="mode" value="separate" checked> Varje fil är ett eget dokument</label>
          <label><input type="radio" name="mode" value="together"> Filerna hör ihop (t.ex. faktura + bilagor)</label>
        </div>
        <button>Läs in &amp; tolka</button>
        <p class="muted small">Tips: i Filer, tryck "Välj" och markera alla filer i mappen. Bara nya filer läses in.</p>
      </form>
    </div>
    <p id="import-status" class="muted"></p>

    <div id="contract-section"></div>

    <h3>Fakturor</h3>
    ${subsTable(subs.filter((s) => s.kind !== 'avtal'), ai, 'Inga fakturor ännu.')}
    <div id="submission-detail"></div>
    <p><button class="ghost small" id="del-project">Ta bort projektet</button></p>`;

  await renderContract(p, subs.filter((s) => s.kind === 'avtal'), ai);
  $('#upload-form').addEventListener('submit', onUpload);
  const on = (sel, fn) => { const el = $(sel); if (el) el.addEventListener('click', fn); };
  on('#pick-folder', () => pickFolder(p));
  on('#sync-btn', () => runSync(`/api/projects/${p.id}/sync`));
  on('#forget-folder', async () => {
    if (!await confirmBox('Koppla bort mappen? Redan inlästa fakturor ligger kvar.')) return;
    await api(`/api/projects/${p.id}/folder`, { method: 'DELETE' });
    await loadProjects(); renderProject();
  });

  $$('[data-open]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); openSubmission(Number(a.dataset.open)); }));
  $$('[data-retry]').forEach((b) => b.addEventListener('click', async () => {
    const sub = subs.find((x) => x.id === Number(b.dataset.retry));
    if (sub && sub.status === 'done' && !await confirmBox('Tolka underlaget igen? Ändringar du gjort på raderna i underlaget försvinner.', 'Kör om')) return;
    await api(`/api/submissions/${b.dataset.retry}/retry`, { method: 'POST' });
    renderProject();
  }));
  $$('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!await confirmBox('Ta bort underlaget och all tolkad data? Filen läses inte in igen vid nästa uppdatering.')) return;
    await api(`/api/submissions/${b.dataset.del}`, { method: 'DELETE' });
    await loadProjects(); renderProject();
  }));
  $('#del-project').addEventListener('click', async () => {
    if (!await confirmBox(`Ta bort projektet ${p.name} med alla underlag? Filerna i din mapp påverkas inte.`)) return;
    await api(`/api/projects/${p.id}`, { method: 'DELETE' });
    state.projectId = null; await loadProjects();
    $('#project-detail').innerHTML = '<p class="muted">Välj eller skapa ett projekt.</p>';
  });

  if (state.importStatus && state.importStatus.projectId === p.id) $('#import-status').textContent = state.importStatus.text;

  clearTimeout(pollTimer);
  if (subs.some((s) => s.status === 'processing')) {
    pollTimer = setTimeout(async () => { await loadProjects(); renderProject(); }, 3000);
  }
  if (state.submissionId) openSubmission(state.submissionId);
}

function subsTable(rows, ai, empty) {
  return `<div class="table-wrap"><table class="subs">
      <thead><tr><th>Inläst</th><th>Underlag</th><th>Status</th><th class="num">Kostnad</th><th></th></tr></thead>
      <tbody>${rows.map((s) => `
        <tr data-id="${s.id}">
          <td data-label="Inläst">${esc(s.uploaded_at.slice(0, 10))}</td>
          <td data-label="Underlag"><a href="#" data-open="${s.id}">${esc(s.label || s.files || 'Underlag ' + s.id)}</a>
            ${s.summary ? `<div class="muted">${esc(s.summary)}</div>` : ''}
            ${s.error ? `<div class="tag warn">${esc(s.error)}</div>` : ''}</td>
          <td data-label="Status">${statusTag(s)}</td>
          <td data-label="Kostnad" class="num">${s.kind === 'avtal' ? '' : kr(s.total)}</td>
          <td class="row">${(s.status === 'error' || s.status === 'done') && ai ? `<button class="small ${s.status === 'done' ? 'ghost' : ''}" data-retry="${s.id}" title="Tolka underlaget igen">Kör om</button>` : ''}
            <button class="small" data-del="${s.id}" title="Ta bort" aria-label="Ta bort">✕</button></td>
        </tr>`).join('') || `<tr><td colspan="5" class="muted">${empty}</td></tr>`}
      </tbody></table></div>`;
}

// ---------- Avtal och avtalskontroll
const FORM_NAME = { fast_pris: 'Fast pris', lopande_rakning: 'Löpande räkning', riktpris: 'Riktpris', blandat: 'Blandat', okand: 'Okänd' };
const DOC_NAME = { kontrakt: 'Kontrakt', offert: 'Offert', kontraktsbilaga: 'Kontraktsbilaga', prislista: 'Prislista', ata_bestallning: 'ÄTA-beställning', ovrigt: 'Övrigt' };
const CLAUSE_NAME = { ingar: 'Ingår i priset', ingar_ej: 'Ingår inte / faktureras separat', ata: 'ÄTA', fakturering: 'Fakturering', ovrigt: 'Övrigt' };
const CHECK_NAME = { fel_pris: 'Fel pris', fel_paslag: 'Fel påslag', ingar_i_avtal: 'Ingår i avtalet', ej_debiterbar: 'Ej debiterbar', saknar_avtalspris: 'Pris saknas i avtalet', over_fast_pris: 'Över fast pris', betalningsvillkor: 'Betalningsvillkor', ata: 'ÄTA', saknar_underlag: 'Underlag saknas', ovrigt: 'Övrigt' };

async function renderContract(p, contractSubs, ai) {
  const c = await api(`/api/projects/${p.id}/contract`);
  const el = $('#contract-section');
  const sum = c.summary;
  const warn = c.findings.filter((f) => f.severity === 'varning');
  const total = (src) => c.findings.filter((f) => f.source === src && f.amount > 0).reduce((s2, f) => s2 + f.amount, 0);
  const finding = (f) => `
    <li class="finding-row ${f.severity}">
      <div class="f-head">
        <span class="tag ${f.severity === 'varning' ? 'warn' : ''}">${esc(CHECK_NAME[f.check_type] || f.check_type)}</span>
        <span class="tag">${f.source === 'kontroll' ? 'Kontroll' : 'Bedömning (Claude)'}</span>
        ${f.amount ? `<b class="num">${kr(f.amount)} kr</b>` : ''}
      </div>
      <div class="f-title">${esc(f.title)}</div>
      ${f.detail ? `<div class="small">${esc(f.detail)}</div>` : ''}
      ${f.contract_ref ? `<div class="f-ref small">Avtalet: ${esc(f.contract_ref)}</div>` : ''}
      <div class="row" style="margin-top:6px">
        ${f.invoice_id ? `<button type="button" class="small" data-goto-inv="${f.invoice_id}">Visa fakturan</button>` : ''}
        <button type="button" class="small ghost" data-dismiss="${f.id}">OK, stämmer</button>
      </div>
    </li>`;
  el.innerHTML = `
    <h3>Avtal</h3>
    ${contractSubs.length ? subsTable(contractSubs, ai, '') : `<p class="muted">Lägg till kontrakt, offert och kontraktsbilagor (t.ex. à-prislista) ovan under <b>Avtal</b>, eller i en undermapp som heter "Avtal". Fakturorna kontrolleras sedan mot avtalet.</p>`}
    ${sum ? `
    <div class="contract-card">
      <dl class="terms">
        <div><dt>Motpart</dt><dd>${esc(sum.counterparty || '–')}</dd></div>
        <div><dt>Prisform</dt><dd>${esc(FORM_NAME[sum.contract_form] || sum.contract_form)}${sum.fixed_price ? ` · ${kr(sum.fixed_price)} kr` : ''}</dd></div>
        <div><dt>Påslag UE / material</dt><dd>${sum.markup_ue_pct ?? '–'} % / ${sum.markup_material_pct ?? '–'} %</dd></div>
        <div><dt>Betalningsvillkor</dt><dd>${sum.payment_days ? sum.payment_days + ' dagar' : '–'}</dd></div>
        <div><dt>ÄTA</dt><dd>${sum.ata_requires_written_order ? 'Skriftlig beställning krävs' : '–'}</dd></div>
      </dl>
      <details><summary>Avtalade priser (${c.rates.length})</summary>
        <div class="table-wrap"><table class="lines rates">
          <thead><tr><th>Beskrivning</th><th class="num">Pris</th><th>Yrke/material</th><th>Källa</th><th></th></tr></thead>
          <tbody>${c.rates.map((r) => `<tr>
            <td data-label="Beskrivning">${esc(r.description)}${r.edited ? ' <span class="tag">ändrad</span>' : ''}</td>
            <td data-label="Pris" class="num">${r.unit_price == null ? '–' : kr2(r.unit_price)} kr/${esc(r.unit || '?')}</td>
            <td data-label="Yrke/material">${esc(r.trade ? tradeName(r.trade) : r.material_type || '')}</td>
            <td data-label="Källa" class="small">${esc(r.doc_title || '')}${r.page ? ' s. ' + esc(r.page) : ''}</td>
            <td><button class="small" aria-label="Ändra pris" data-rate='${esc(JSON.stringify(r))}'>✎</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">Inga priser hittades i avtalet.</td></tr>'}</tbody>
        </table></div></details>
      <details><summary>Villkor (${c.clauses.length})</summary>
        ${Object.keys(CLAUSE_NAME).map((k) => { const list = c.clauses.filter((x) => x.kind === k); return list.length ? `<h4>${CLAUSE_NAME[k]}</h4><ul>${list.map((x) => `<li>${esc(x.text)} <span class="muted small">${esc(x.doc_title || '')}${x.page ? ' s. ' + esc(x.page) : ''}</span></li>`).join('')}</ul>` : ''; }).join('')}
      </details>
    </div>

    <div class="review">
      <div class="row" style="justify-content:space-between; align-items:flex-end">
        <div>
          <h3 style="margin:0">Avtalskontroll</h3>
          <div class="muted small">${warn.length} att kontrollera · möjlig överdebitering ${kr(total('kontroll'))} kr enligt kontroll${c.review_at ? `, ${kr(total('bedomning'))} kr enligt Claudes bedömning (${esc(fmtTime(c.review_at))})` : ''}</div>
        </div>
        ${ai ? `<button type="button" id="run-review">${c.review_at ? 'Granska igen med Claude' : 'Granska med Claude'}</button>` : ''}
      </div>
      <p class="muted small">Kontroll = beräknat mot avtalade priser, påslag och villkor. Bedömning = Claude läser avtalstexten mot fakturaraderna; kontrollera alltid hänvisningen innan du agerar.</p>
      <p id="review-status" class="muted"></p>
      ${c.findings.length ? `<ul class="list findings-list">${c.findings.map(finding).join('')}</ul>` : '<p class="ok-line">✓ Inga avvikelser mot avtalet hittades.</p>'}
      ${c.dismissed ? `<button type="button" class="small ghost" id="restore-dismissed">Visa ${c.dismissed} godkända avvikelser igen</button>` : ''}
    </div>` : ''}`;

  $$('[data-rate]', el).forEach((b) => b.addEventListener('click', () => editRate(JSON.parse(b.dataset.rate))));
  $$('[data-dismiss]', el).forEach((b) => b.addEventListener('click', async () => {
    await api(`/api/review-findings/${b.dataset.dismiss}/dismiss`, { method: 'POST' });
    await renderProject();
  }));
  $$('[data-goto-inv]', el).forEach((b) => b.addEventListener('click', async () => {
    const subsList = await api(`/api/projects/${p.id}/submissions`);
    for (const s2 of subsList) {
      const d = await api(`/api/submissions/${s2.id}`);
      if (d.invoices.some((i) => i.id === Number(b.dataset.gotoInv))) {
        await openSubmission(s2.id);
        $('#submission-detail').scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
  }));
  const restore = $('#restore-dismissed');
  if (restore) restore.addEventListener('click', async () => { await api(`/api/projects/${p.id}/review/restore`, { method: 'POST' }); await renderProject(); });
  const run = $('#run-review');
  if (run) run.addEventListener('click', async () => {
    run.disabled = true;
    $('#review-status').innerHTML = '<span class="spinner"></span> Claude granskar fakturorna mot avtalet … (kan ta en minut)';
    try {
      const r = await api(`/api/projects/${p.id}/review`, { method: 'POST' });
      await renderProject();
      $('#review-status').textContent = r.findings ? `Claude hittade ${r.findings} ${r.findings === 1 ? 'sak' : 'saker'} att kontrollera.` : 'Claude hittade inget ytterligare.';
    } catch (err) { $('#review-status').textContent = err.message; run.disabled = false; }
  });
}

function renderContractDoc(t) {
  return `<div class="inv">
    <div class="inv-head"><div><b>${esc(t.title)}</b> · ${esc(DOC_NAME[t.doc_type] || t.doc_type)} <span class="muted">${t.doc_date ? '· ' + esc(t.doc_date) : ''} · sid ${esc(t.pages || '')}</span></div>
      <div>${esc(FORM_NAME[t.contract_form] || '')}${t.fixed_price ? ' · ' + kr(t.fixed_price) + ' kr' : ''}</div></div>
    <p class="small">${t.counterparty ? 'Motpart: ' + esc(t.counterparty) + ' · ' : ''}${t.markup_ue_pct != null ? 'Påslag UE ' + t.markup_ue_pct + ' % · ' : ''}${t.markup_material_pct != null ? 'material ' + t.markup_material_pct + ' % · ' : ''}${t.payment_days ? 'betalning ' + t.payment_days + ' dagar' : ''}</p>
    ${t.rates.length ? `<div class="table-wrap"><table class="lines"><thead><tr><th>Pris</th><th class="num">Belopp</th><th>Sida</th></tr></thead><tbody>${t.rates.map((r) => `<tr><td data-label="Pris">${esc(r.description)}</td><td data-label="Belopp" class="num">${r.unit_price == null ? '–' : kr2(r.unit_price)} kr/${esc(r.unit || '?')}</td><td data-label="Sida">${esc(r.page || '')}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${t.clauses.length ? `<ul class="small">${t.clauses.map((x) => `<li><b>${esc(CLAUSE_NAME[x.kind] || x.kind)}:</b> ${esc(x.text)}</li>`).join('')}</ul>` : ''}
  </div>`;
}

function editRate(r) {
  const dlg = $('#rate-dialog');
  const f = $('#rate-form');
  f.trade.innerHTML = '<option value="">–</option>' + Object.entries(state.meta.trades).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  f.description.value = r.description; f.unit_price.value = r.unit_price ?? ''; f.unit.value = r.unit || '';
  f.trade.value = r.trade || ''; f.material_type.value = r.material_type || '';
  $('#rate-quote').textContent = r.quote ? `Avtalet: "${r.quote}"` : '';
  dlg.returnValue = '';
  dlg.showModal();
  dlg.onclose = async () => {
    try {
      if (dlg.returnValue === 'save') {
        await api(`/api/contract-rates/${r.id}`, { method: 'PATCH', body: { description: f.description.value, unit_price: f.unit_price.value, unit: f.unit.value, trade: f.trade.value, material_type: f.material_type.value } });
      } else if (dlg.returnValue === 'delete') {
        await api(`/api/contract-rates/${r.id}`, { method: 'DELETE' });
      } else return;
      renderProject();
    } catch (err) { notify(err.message); }
  };
}

// SQLite sparar tid i UTC – visa i lokal tid
const fmtTime = (t) => new Date(t.replace(' ', 'T') + 'Z').toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });

function statusTag(s) {
  if (s.status === 'processing') return '<span class="spinner"></span> Tolkar…';
  if (s.status === 'error') return '<span class="tag warn">Fel</span>';
  if (s.status === 'done') return s.warnings ? `<span class="tag warn">${s.warnings} att kontrollera</span>` : '<span class="tag ok">Klar</span>';
  return esc(s.status);
}

function importSummary(r) {
  const parts = [];
  parts.push(r.imported ? `${r.imported} nya filer läses in (${r.submissions.length} underlag)` : 'Inga nya filer');
  if (r.skipped && r.skipped.length) parts.push(`${r.skipped.length} redan inlästa`);
  if (r.ignored && r.ignored.length) parts.push(`${r.ignored.length} tidigare borttagna hoppades över`);
  return parts.join(' · ');
}
// Statusraden sparas så att den finns kvar när listan ritas om under tolkningen
function setImportStatus(text) {
  state.importStatus = { projectId: state.projectId, text };
  const el = $('#import-status');
  if (el) el.textContent = text;
}

async function runSync(url) {
  setImportStatus('Letar efter nya fakturor…');
  $$('#sync-btn, #sync-all').forEach((b) => { b.disabled = true; });
  try {
    const r = await api(url, { method: 'POST' });
    const list = r.results || [r];
    const msg = list.map((x) => (x.error ? `${x.project || 'Projekt'}: ${x.error}` : `${x.project}: ${importSummary(x)}`)).join('\n');
    await loadProjects(); await renderProject();
    setImportStatus(msg || 'Inga projekt har en mapp vald.');
  } catch (err) { setImportStatus(err.message); } finally {
    $$('#sync-btn, #sync-all').forEach((b) => { b.disabled = false; });
  }
}

async function pickFolder(p) {
  try {
    await api(`/api/projects/${p.id}/folder`, { method: 'POST' });
    await loadProjects(); await renderProject();
    runSync(`/api/projects/${p.id}/sync`);
  } catch (err) {
    if (err.name !== 'AbortError' && !/avbrut|cancel/i.test(err.message)) setImportStatus(err.message);
  }
}

async function onUpload(e) {
  e.preventDefault();
  const form = e.target;
  const files = [...form.files.files];
  if (!files.length) return notify('Välj en eller flera filer.');
  const btn = $('button', form);
  btn.disabled = true;
  setImportStatus('Läser filerna…');
  try {
    const r = await api(`/api/projects/${state.projectId}/submissions`, { method: 'POST', body: { files, mode: form.mode.value, kind: form.kind.value } });
    form.reset();
    await loadProjects(); await renderProject();
    setImportStatus(importSummary(r));
  } catch (err) { setImportStatus(err.message); } finally { btn.disabled = false; }
}

$('#sync-all').addEventListener('click', () => runSync('/api/sync'));

// Originalfil visas i appen
async function showFile(id) {
  const { name, blob } = await api(`/api/files/${id}`);
  const dlg = $('#file-dialog');
  const urls = [];
  const frame = $('#file-frame');
  $('#file-title').textContent = name;
  dlg.onclose = () => { urls.forEach((u) => URL.revokeObjectURL(u)); frame.innerHTML = ''; };
  dlg.showModal();
  if (blob.type.startsWith('image/')) {
    urls.push(URL.createObjectURL(blob));
    frame.innerHTML = `<img src="${urls[0]}" alt="">`;
  } else if (blob.type === 'application/pdf' && globalThis.pdfjsLib) {
    // Där inbäddade PDF:er inte tillåts ritas sidorna som bilder
    frame.innerHTML = '<p class="muted"><span class="spinner"></span> Öppnar…</p>';
    const pages = await renderPdfImages(blob);
    urls.push(...pages.map((b) => URL.createObjectURL(b)));
    frame.innerHTML = urls.map((u, i) => `<img src="${u}" alt="Sida ${i + 1}">`).join('');
  } else {
    urls.push(URL.createObjectURL(blob));
    frame.innerHTML = `<iframe src="${urls[0]}" title="${esc(name)}"></iframe>`;
  }
}
$('#file-close').addEventListener('click', () => $('#file-dialog').close());

async function openSubmission(id) {
  state.submissionId = id;
  const d = await api(`/api/submissions/${id}`);
  const byParent = new Map();
  d.invoices.forEach((i) => { const k = i.parent_invoice_id || 0; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k).push(i); });
  const ids = new Set(d.invoices.map((i) => i.id));
  const roots = d.invoices.filter((i) => !i.parent_invoice_id || !ids.has(i.parent_invoice_id));
  const lineFind = new Map();
  for (const f of d.lineFindings || []) { if (!lineFind.has(f.line_id)) lineFind.set(f.line_id, []); lineFind.get(f.line_id).push(f); }
  const FIND_LABEL = { fel_pris: 'Över avtalspris', fel_paslag: 'Fel påslag', ingar_i_avtal: 'Kan ingå i avtalet', ej_debiterbar: 'Ej debiterbar?', ata: 'ÄTA', saknar_underlag: 'Underlag saknas' };
  const findTags = (l) => (lineFind.get(l.id) || []).map((f) => `<span class="tag warn" title="${esc(f.title)}">⚖︎ ${esc(FIND_LABEL[f.check_type] || 'Avtal')}${f.amount ? ' ' + kr(f.amount) + ' kr' : ''}</span>`).join('');
  const renderInv = (inv, child) => `
    <div class="inv ${child ? 'child' : ''}">
      <div class="inv-head">
        <div><b>${esc(inv.supplier_name)}</b> · ${esc(kindName(inv.kind))} ${esc(inv.invoice_number || '')}
          <span class="muted">· ${esc(inv.invoice_date || '')} · sid ${esc(inv.pages || '')}</span>
          ${inv.is_duplicate ? '<span class="tag warn">Dubblett – räknas ej</span>' : ''}</div>
        <div>${kr2(inv.amount_excl_vat)} kr exkl. moms ${markupTag(inv)}</div>
      </div>
      <div class="table-wrap"><table class="lines">
        <thead><tr><th>Beskrivning</th><th>Datum</th><th class="num">Antal</th><th class="num">À-pris</th>
          <th class="num">Belopp</th><th>Typ</th><th class="num">Kostnad beställare</th><th></th></tr></thead>
        <tbody>${inv.lines.map((l) => `
          <tr class="${l.counted ? '' : 'not-counted'}" title="${l.counted ? '' : 'Räknas via bilagans rader / dubblett'}">
            <td data-label="Beskrivning">${esc(l.description)}${l.resource_name ? ` <span class="muted">(${esc(l.resource_name)})</span>` : ''}</td>
            <td data-label="Datum">${esc(l.line_date || '')}</td>
            <td data-label="Antal" class="num">${l.quantity == null ? '' : kr(l.quantity, 2)} ${esc(l.unit || l.unit_raw || '')}</td>
            <td data-label="À-pris" class="num">${kr2(l.unit_price)}</td>
            <td data-label="Belopp" class="num">${kr2(l.amount_excl_vat)}</td>
            <td data-label="Typ"><span class="tag">${esc(catName(l.cost_category))}</span>
              ${l.trade ? `<span class="tag">${esc(tradeName(l.trade))}</span>` : ''}
              ${l.material_type ? `<span class="tag">${esc(l.material_type)}</span>` : ''}${findTags(l)}</td>
            <td data-label="Kostnad beställare" class="num">${l.counted ? kr2(l.effective_amount) : 'räknas via bilaga'}</td>
            <td><button class="small" aria-label="Ändra" data-edit='${esc(JSON.stringify(l))}'>✎</button></td>
          </tr>`).join('')}</tbody></table></div>
    </div>
    ${(byParent.get(inv.id) || []).map((c) => renderInv(c, true)).join('')}`;

  $('#submission-detail').innerHTML = `
    <div class="panel" style="margin-top:16px">
      <div class="row" style="justify-content:space-between"><h2 style="margin:0">${esc(d.submission.label || 'Underlag')}</h2>
        <button class="small" id="close-sub">Stäng</button></div>
      <p>${esc(d.submission.summary || '')}</p>
      ${readLog(d.submission.read_log)}
      <div class="row">${d.files.map((f) => `<a href="#" data-file="${f.id}">📄 ${esc(f.original_name)}</a>`).join(' ')}</div>
      ${d.findings.map((f) => `<div class="finding ${f.severity}">${f.severity === 'varning' ? '⚠️' : 'ℹ️'} ${esc(f.message)}</div>`).join('')}
      ${roots.map((r) => renderInv(r, false)).join('')}
      ${(d.contractDocs || []).map(renderContractDoc).join('')}
      ${d.supporting.length ? `<h3>Bilagor utan belopp</h3>${d.supporting.map((s) => `
        <div class="inv"><b>${esc(s.title)}</b> <span class="muted">· ${esc(s.doc_type)} · sid ${esc(s.pages)}</span>
        <div>${esc(s.text_summary)}</div></div>`).join('')}` : ''}
    </div>`;
  $('#close-sub').addEventListener('click', () => { state.submissionId = null; $('#submission-detail').innerHTML = ''; });
  $$('[data-edit]').forEach((b) => b.addEventListener('click', () => editLine(JSON.parse(b.dataset.edit))));
  $$('[data-file]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); showFile(Number(a.dataset.file)).catch((err) => notify(err.message)); }));
}

// Hur underlaget lästes: antal sidor, text/skannat och om någon sida inte kunde tolkas
function readLog(json) {
  if (!json) return '';
  let l;
  try { l = JSON.parse(json); } catch { return ''; }
  const unlinked = l.unlinked || [];
  const ok = (!l.missing || !l.missing.length) && !unlinked.length;
  const pagesText = l.pages != null ? `${l.pages} sidor lästa: ${l.text_pages} med text, ${l.scanned_pages} skannade` : 'Underlaget lästes';
  return `<p class="small ${ok ? 'muted' : ''}">${ok ? '✓' : '⚠️'} ${pagesText}
    ${l.passes > 1 ? ` · ${l.passes - 1} kompletterande tolkning${l.passes > 2 ? 'ar' : ''} för missade sidor` : ''}
    ${ok ? ' · alla sidor och bilagor tolkade' : ''}${l.missing && l.missing.length ? ` · ej tolkade: ${esc(l.missing.join(', '))}` : ''}
    ${unlinked.length ? ` · leverantörsfaktura saknas för: ${esc(unlinked.join('; '))} – tryck Kör om` : ''}</p>`;
}

const kindName = (k) => ({ huvudfaktura: 'Faktura', underleverantorsfaktura: 'Bilaga (UE/leverantör)', kvitto: 'Kvitto', kreditfaktura: 'Kreditfaktura' }[k] || k);
function markupTag(inv) {
  if (inv.markup_status === 'ok') return `<span class="tag ok">vidarefakturerat ${kr2(inv.billed_amount)} (påslag ${((inv.billed_ratio - 1) * 100).toFixed(1).replace('.', ',')} %)</span>`;
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
    } catch (err) { notify(err.message); }
  };
}

// ---------- Gemensamma filter (analys + fråga)
function projectChips(selectedId) {
  return `<div class="chips">${state.projects.map((p) => `<label class="chip"><input type="checkbox" name="projects" value="${p.id}" ${p.id === selectedId ? 'checked' : ''}><span>${esc(p.name)}</span></label>`).join('')}</div>`;
}
async function filterControls(container, onChange) {
  const dims = await api('/api/analysis/dimensions');
  container.innerHTML = `
    <div class="field">Projekt ${projectChips(state.projectId)}</div>
    <label>Från månad <select name="from"><option value="">–</option>${dims.months.map((m) => `<option>${m}</option>`).join('')}</select></label>
    <label>Till månad <select name="to"><option value="">–</option>${dims.months.map((m) => `<option>${m}</option>`).join('')}</select></label>
    <label>Månad avser <select name="monthBasis"><option value="work">När arbetet utfördes</option><option value="invoice">Fakturadatum</option></select></label>
    <label>Leverantör <select name="supplier"><option value="">Alla</option>${dims.suppliers.map((s) => `<option>${esc(s)}</option>`).join('')}</select></label>
    <label>Kostnadstyp <select name="category"><option value="">Alla</option>${Object.entries(state.meta.categories).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
    <span class="muted small">Inga projekt markerade = alla projekt</span>`;
  $$('select, input', container).forEach((s) => s.addEventListener('change', onChange));
}
function readFilters(container) {
  const g = (n) => $(`[name=${n}]`, container);
  return {
    projectIds: $$('input[name=projects]:checked', container).map((o) => Number(o.value)),
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
  $('#cmp-projects').innerHTML = projectChips(null).replace(/^<div class="chips">|<\/div>$/g, '');
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
  const projects = $$('#cmp-projects input:checked').map((o) => o.value).join(',');
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
async function initAsk() {
  if (askInit) return;
  askInit = true;
  await filterControls($('#ask-filters'), () => {});
  renderQuestions();
}

// Mina frågor: allt du frågar sparas; stjärnmärk de du ställer ofta.
async function renderQuestions() {
  const qs = await api('/api/questions');
  const favs = qs.filter((q) => q.favorite);
  const recent = qs.filter((q) => !q.favorite).slice(0, 30);
  const item = (q) => `
    <li class="q-item" data-q="${q.id}">
      <button type="button" class="star ${q.favorite ? 'on' : ''}" data-star="${q.id}" aria-pressed="${q.favorite ? 'true' : 'false'}"
        aria-label="${q.favorite ? 'Ta bort från favoriter' : 'Spara som favorit'}">${q.favorite ? '★' : '☆'}</button>
      <div class="q-body">
        <a href="#" data-use="${q.id}">${esc(q.text)}</a>
        <div class="muted small">Ställd ${q.times_asked} ${q.times_asked === 1 ? 'gång' : 'gånger'}${q.last_asked_at ? ' · senast ' + esc(fmtTime(q.last_asked_at)) : ''}</div>
        ${q.last_answer ? `<details><summary>Senaste svar</summary><div class="answer">${markdown(q.last_answer)}</div></details>` : ''}
      </div>
      <div class="q-actions">
        <button type="button" class="small" data-run="${q.id}">Fråga igen</button>
        <button type="button" class="small" data-qdel="${q.id}" aria-label="Ta bort frågan">✕</button>
      </div>
    </li>`;
  $('#my-questions').innerHTML = qs.length ? `
    <h2>Mina frågor</h2>
    ${favs.length ? `<h3>★ Favoriter</h3><ul class="list q-list">${favs.map(item).join('')}</ul>` : '<p class="muted small">Tryck ☆ vid en fråga för att spara den som favorit.</p>'}
    ${recent.length ? `<h3>Senaste</h3><ul class="list q-list">${recent.map(item).join('')}</ul>` : ''}`
    : '<h2>Mina frågor</h2><p class="muted">Frågorna du ställer sparas här. Markera de du ställer ofta med ☆ så hamnar de överst.</p>';
  const byId = (id) => qs.find((q) => q.id === Number(id));
  $$('[data-star]', $('#my-questions')).forEach((b) => b.addEventListener('click', async () => {
    const q = byId(b.dataset.star);
    await api(`/api/questions/${q.id}`, { method: 'PATCH', body: { favorite: !q.favorite } });
    renderQuestions();
  }));
  $$('[data-use]', $('#my-questions')).forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    $('#ask-q').value = byId(a.dataset.use).text;
    $('#ask-q').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
  $$('[data-run]', $('#my-questions')).forEach((b) => b.addEventListener('click', () => {
    $('#ask-q').value = byId(b.dataset.run).text;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    $('#ask-form').requestSubmit();
  }));
  $$('[data-qdel]', $('#my-questions')).forEach((b) => b.addEventListener('click', async () => {
    if (!await confirmBox('Ta bort frågan från listan?')) return;
    await api(`/api/questions/${b.dataset.qdel}`, { method: 'DELETE' });
    renderQuestions();
  }));
}

$('#ask-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = $('#ask-q').value.trim();
  if (!question) return;
  const scope = readFilters($('#ask-filters'));
  const box = document.createElement('div');
  box.className = 'panel';
  box.innerHTML = `<div class="row" style="justify-content:space-between"><b>${esc(question)}</b><span class="fav-slot"></span></div>
    <div class="answer"><span class="spinner"></span> Analyserar…</div>`;
  $('#ask-log').prepend(box);
  $('#ask-btn').disabled = true;
  try {
    const r = await api('/api/ask', { method: 'POST', body: { question, scope, history: state.askHistory } });
    state.askHistory.push({ role: 'user', content: question }, { role: 'assistant', content: r.answer });
    $('.answer', box).innerHTML = markdown(r.answer) + (r.queries.length ? `<details><summary>Visa ${r.queries.length} databasfrågor bakom svaret</summary>${r.queries.map((q) => `<p><b>${esc(q.purpose)}</b> ${q.error ? `<span class="tag warn">${esc(q.error)}</span>` : `<span class="muted">(${q.rows} rader)</span>`}</p><pre>${esc(q.sql)}</pre>`).join('')}</details>` : '');
    if (r.questionId) {
      const fav = document.createElement('button');
      fav.type = 'button';
      fav.className = 'small';
      fav.textContent = '☆ Spara som favorit';
      fav.addEventListener('click', async () => {
        await api(`/api/questions/${r.questionId}`, { method: 'PATCH', body: { favorite: true } });
        fav.textContent = '★ Favorit';
        fav.disabled = true;
        renderQuestions();
      });
      $('.fav-slot', box).append(fav);
    }
    $('#ask-q').value = '';
  } catch (err) {
    $('.answer', box).innerHTML = `<span class="tag warn">${esc(err.message)}</span>`;
  } finally {
    $('#ask-btn').disabled = false;
    renderQuestions();
  }
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

// ---------- Inställningar
async function renderSettings() {
  const st = await api('/api/settings');
  let usage = '';
  try {
    const est = await navigator.storage.estimate();
    usage = `Appen använder ${(est.usage / 1e6).toFixed(1)} MB på enheten.`;
  } catch { /* okänt */ }
  $('#settings-out').innerHTML = `
    ${st.llmMode === 'sample' ? `<div class="panel stack">
      <h2>Claude</h2>
      <p class="muted">Tolkning och frågor går via ditt Claude-konto – ingen API-nyckel behövs. Första gången
        frågar Claude om appen får använda ditt konto. Fakturorna skickas till Claude för tolkning – allt annat stannar på enheten.</p>
    </div>` : `<div class="panel stack">
      <h2>API-nyckel för Claude</h2>
      <p class="muted">Behövs för att tolka fakturor och ställa frågor. Nyckeln sparas bara på den här enheten.
        Fakturorna skickas till Claude för tolkning – allt annat stannar på enheten.</p>
      <p>${st.hasApiKey ? `Sparad nyckel: <b>${esc(st.apiKeyHint)}</b>` : '<span class="tag warn">Ingen nyckel sparad</span>'}</p>
      <form id="key-form" class="row">
        <input name="apiKey" type="password" placeholder="sk-ant-…" autocomplete="off" style="flex:1 1 240px">
        <button>Spara</button>
        ${st.hasApiKey ? '<button type="button" class="ghost" id="key-clear">Ta bort</button>' : ''}
      </form>
    </div>`}
    <div class="panel stack">
      <h2>Data på enheten</h2>
      <p class="muted">${esc(usage)} Om appen raderas försvinner datan – gör en säkerhetskopia ibland.
        Originalfilerna finns kvar i din mapp och kan läsas in igen.</p>
      <div class="row">
        <button type="button" id="backup">Spara säkerhetskopia…</button>
        <label class="ghost-btn">Återställ från säkerhetskopia<input type="file" id="restore" accept=".sqlite,.db,.json,application/json,application/octet-stream" hidden></label>
        <button type="button" class="ghost" id="demo">Läs in exempel (Karlavägen 71)</button>
      </div>
      <p id="settings-status" class="muted"></p>
    </div>`;
  if ($('#key-form')) $('#key-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await api('/api/settings', { method: 'PUT', body: { apiKey: e.target.apiKey.value } });
    state.meta = await api('/api/meta'); renderSettings();
  });
  const clear = $('#key-clear');
  if (clear) clear.addEventListener('click', async () => { await api('/api/settings', { method: 'PUT', body: { apiKey: '' } }); state.meta = await api('/api/meta'); renderSettings(); });
  $('#backup').addEventListener('click', async () => {
    try { $('#settings-status').textContent = await api('/api/backup'); } catch (err) { $('#settings-status').textContent = err.message; }
  });
  $('#restore').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f || !await confirmBox('Ersätta all data i appen med säkerhetskopian?')) return;
    try {
      await api('/api/restore', { method: 'POST', body: { bytes: new Uint8Array(await f.arrayBuffer()) } });
      location.reload();
    } catch (err) { $('#settings-status').textContent = err.message; }
  });
  $('#demo').addEventListener('click', async () => {
    const r = await api('/api/demo', { method: 'POST' });
    analysisInit = false; askInit = false;
    await selectProject(r.id); showTab('projekt');
  });
}

// ---------- Start
async function start(localApi) {
  setApi(localApi);
  state.meta = await api('/api/meta');
  await loadProjects();
  if (state.projects[0]) selectProject(state.projects[0].id);
  else if (!state.meta.aiEnabled) showTab('installningar');
}

module.exports = { start };
