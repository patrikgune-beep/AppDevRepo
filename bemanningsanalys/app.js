(function () {
'use strict';

/* ============================================================ helpers */
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 });
const fmt = v => (v == null || isNaN(v)) ? '' : nf.format(Math.abs(v) < 0.005 ? 0 : v);
const lc = s => String(s == null ? '' : s).toLowerCase();
const isTimeCol = n => /^(år|månad|period|prognostillfälle|tillfälle|tidplan)/i.test(n);
const STOP = new Set('och att det som för med den ett har inte till från vara vilka vilken vilket hur många mycket per fördelat fördelad uppdelat uppdelad visa lista alla totalt summa sammanlagt vi oss ska skulle kan blir blev inom under efter över mellan samt eller också när där dessa detta mina våra'.split(' '));

/* ============================================================ state */
const state = {
  datasets: [],          // förladdade + uppladdade
  active: null,
  q: null,               // senaste tolkade frågan
  lastResult: null,
  view: 'table',
  builderOpen: false,
};

const HINTS = {
  atgarder: {
    words: ['åtgärd', 'minskar', 'minska', 'minskning', 'besparing', 'åa', 'årsarbetskraft', 'senarelägg', 'uppdragskonsult', 'neddragning', 'effekt', 'tidplan'],
    measure: 'Total förändring ÅA',
    measureAlias: [[/inlånade.*(trv|övriga)|(trv|övriga).*inlånade/, 'Inlånade övriga TRV ÅA'], [/inlånade/, 'Inlånade internt PR ÅA'], [/egna/, 'Egna resurser ÅA']],
  },
  atgardsplan_summering: { words: ['basnivå', 'heroma', 'summering', 'effekt per kategori'], measure: 'Summa effekt (ÅA)' },
  forandring_resursbehov: { words: ['prognostillfälle', 'tillfälle', 'jämför', 'ändrats', 'konsult', 'anställd', 'verksamhetsområde'], measure: 'ÅA' },
  rekrytering_2027: { words: ['rekrytering', 'rekryteringsbehov', 'personalomsättning', 'omsättning', 'utfall'], measure: 'Rekryteringsbehov t.o.m. 2027' },
  befattning_kategori: { words: ['mappning', 'hör till', 'vilka befattningar'], measure: null },
  resurs_t2: { words: ['resurs', 'konsult', 'timkostnad', 'roll', 'enhet', 'resurstyp'], measure: 'ÅA' },
  befattning_ma_t2: { words: ['månad', 'månadsarbetskraft', 'ma'], measure: 'MA' },
  program_aa: { words: ['program', 'vakant', 'vakanser', 'tilldelat'], measure: 'ÅA' },
  egna_resurser: { words: ['rekryteringar', 'nuvarande bemanning', 'egna resurser', 'planerade'], measure: 'ÅA' },
  slides: { words: ['risk', 'risker', 'möjlighet', 'möjligheter', 'bubblare', 'slide', 'presentation', 'bedömning'], measure: null },
};

const EXAMPLES = [
  'Hur många ÅA minskar vi med per befattningskategori, fördelat per avdelning?',
  'Hur många ÅA minskar egna resurser per avdelning?',
  'Vilka åtgärder för Projektledning väg och järnväg minskar mest?',
  'Summa ÅA per program och status för 2027 i T2 2026',
  'Vilka risker och möjligheter ser Västlänken?',
  'Rekryteringsbehov per befattningskategori',
];

/* ============================================================ dataset prep */
function prep(ds) {
  if (ds._p) return ds;
  ds.colIdx = {};
  ds.columns.forEach((c, i) => { ds.colIdx[c.name] = i; });
  ds.numCols = ds.columns.filter(c => c.type === 'num').map(c => c.name);
  ds.dimCols = ds.columns.filter(c => c.role === 'dim').map(c => c.name);
  ds._distinct = {};
  ds._p = true;
  return ds;
}
function distinct(ds, name) {
  if (ds._distinct[name]) return ds._distinct[name];
  const i = ds.colIdx[name], set = new Map();
  for (const r of ds.rows) { const v = r[i]; if (v != null && v !== '') set.set(v, (set.get(v) || 0) + 1); }
  return (ds._distinct[name] = [...set.keys()]);
}
function inferRoles(cols, rows) {
  cols.forEach((c, i) => {
    if (c.type === 'num') { c.role = null; return; }
    const set = new Set(); let tot = 0, longest = 0;
    for (const r of rows) { const v = r[i]; if (v != null && v !== '') { tot++; set.add(v); if (String(v).length > longest) longest = String(v).length; } }
    c.role = (set.size <= 400 && (set.size / Math.max(tot, 1) < 0.6 || rows.length < 60) && longest < 90) ? 'dim' : 'text';
  });
}

/* ============================================================ frågetolkning */
const GROUP_TRIG = /(fördelat\s+per|fördelad\s+per|fördelat\s+på|fördelad\s+på|uppdelat\s+per|uppdelad\s+per|uppdelat\s+på|uppdelad\s+på|grupperat\s+per|grupperat\s+på|för\s+varje|i\s+varje|inom\s+varje|\bper\b)\s+/g;

function aliasesFor(name) {
  const n = lc(name).replace(/\(.*?\)/g, '').trim();
  const out = new Set([n]);
  n.split(/[\s\/\-–]+/).forEach(w => { if (w.length >= 4 && !/^(resursbehov|resursens)$/.test(w)) out.add(w); });
  if (/kategori/.test(n)) out.add('kategori');
  if (/^avdelning/.test(n)) { out.add('avdelning'); }
  if (/^år$/.test(n)) out.add('år');
  return [...out];
}
function aliasRe(a) { return new RegExp('(^|[^a-zåäö0-9])(' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')[a-zåäö]{0,4}(?![a-zåäö0-9])', 'g'); }

function groupSegments(text) {
  const segs = []; let m; GROUP_TRIG.lastIndex = 0;
  const hits = [];
  while ((m = GROUP_TRIG.exec(text))) hits.push({ s: m.index + m[0].length });
  hits.forEach((h, k) => {
    let end = k + 1 < hits.length ? hits.slice(k + 1)[0].s : text.length;
    let seg = text.slice(h.s, end);
    const cut = seg.search(/[.?!;]|\s(för|i|under|inom|med|som|där|när)\s/);
    if (cut >= 0) seg = seg.slice(0, cut);
    segs.push(seg);
  });
  return segs;
}

function scoreDataset(ds, text, orig) {
  prep(ds);
  const h = HINTS[ds.id] || { words: [] };
  let score = 0;
  h.words.forEach(w => { if (aliasRe(w).test(text)) score += 3; });
  lc(ds.name).split(/[\s\(\),:–-]+/).filter(w => w.length >= 5).forEach(w => { if (text.includes(w)) score += 2; });
  ds.columns.forEach(c => { if (aliasesFor(c.name).some(a => a.length >= 4 && !/^[\d\s-]+$/.test(a) && aliasRe(a).test(text))) score += 1.5; });
  ds.dimCols.forEach(cn => {
    const vals = distinct(ds, cn);
    if (vals.length > 600) return;
    for (const v of vals) { const s = lc(v); if (s.length >= 5 && text.includes(s)) { score += 4; break; } }
  });
  return score;
}

function findFilters(ds, text, orig, groupCols) {
  const cand = [];
  ds.dimCols.forEach(cn => {
    const vals = distinct(ds, cn);
    if (vals.length > 600) return;
    const firstWords = {};
    vals.forEach(v => { const fw = lc(String(v)).split(/[\s\/,]+/)[0]; (firstWords[fw] = firstWords[fw] || []).push(v); });
    vals.forEach(v => {
      const s = lc(String(v)); if (!s) return;
      if (s.length <= 3 && !new RegExp('(^|[^A-Za-zÅÄÖåäö0-9])' + String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-zÅÄÖåäö0-9])').test(orig)) return;
      const re = aliasRe(s);
      let m; while ((m = re.exec(text))) cand.push({ col: cn, val: v, start: m.index + m[1].length, end: m.index + m[1].length + s.length });
    });
    Object.entries(firstWords).forEach(([fw, arr]) => {
      if (arr.length === 1 && fw.length >= 7) {
        const re = aliasRe(fw); let m;
        while ((m = re.exec(text))) cand.push({ col: cn, val: arr[0], start: m.index + m[1].length, end: m.index + m[1].length + fw.length });
      }
    });
  });
  cand.sort((a, b) => (b.end - b.start) - (a.end - a.start));
  const taken = [], res = [];
  for (const c of cand) {
    if (taken.some(t => c.start < t.end && c.end > t.start)) continue;
    taken.push(c); res.push(c);
  }
  const by = {};
  res.forEach(c => { (by[c.col] = by[c.col] || { col: c.col, vals: [] }); if (!by[c.col].vals.includes(c.val)) by[c.col].vals.push(c.val); });
  return { filters: Object.values(by), spans: taken };
}

function parseQuestion(question, keepDs) {
  const orig = question, text = lc(question);
  prep0();
  let best = null, bs = -1;
  state.datasets.forEach(ds => { const s = scoreDataset(ds, text, orig); if (s > bs) { bs = s; best = ds; } });
  let ds = bs <= 0 ? (keepDs || state.datasets.find(d => d.id === state.active) || state.datasets[0]) : best;
  prep(ds);
  const q = { ds: ds.id, measure: null, agg: 'sum', group: [], filters: [], sign: null, mode: 'agg', limit: null, search: '' };

  // aggregation
  if (/\bantal\s+(åtgärder|resurser|rader|poster|personer|program|befattningar|slides?)|hur\s+många\s+(åtgärder|resurser|rader|poster|personer|program|befattningar)/.test(text)) q.agg = 'count';
  else if (/medel|snitt|genomsnitt/.test(text)) q.agg = 'avg';
  else if (/\b(max|maximal|maximalt|största enskilda)\b/.test(text)) q.agg = 'max';
  else if (/\b(min|minimal|minsta enskilda)\b/.test(text)) q.agg = 'min';

  // mått
  const hint = HINTS[ds.id] || {};
  if (hint.measureAlias) for (const [re, col] of hint.measureAlias) if (re.test(text) && ds.colIdx[col] != null) { q.measure = col; break; }
  if (!q.measure) {
    let sc = -1;
    ds.numCols.forEach(n => { let s = 0; aliasesFor(n).forEach(a => { if (a.length >= 3 && aliasRe(a).test(text)) s += a.length; }); if (s > sc) { sc = s; if (s > 0) q.measure = n; } });
  }
  if (!q.measure) q.measure = (hint.measure && ds.colIdx[hint.measure] != null) ? hint.measure : (ds.numCols[ds.numCols.length - 1] || null);

  // gruppering
  const segs = groupSegments(text);
  const found = [];
  segs.forEach(seg => {
    const cands = [];
    ds.dimCols.forEach(cn => aliasesFor(cn).forEach(a => {
      const re = aliasRe(a); let m;
      while ((m = re.exec(seg))) cands.push({ col: cn, start: m.index + m[1].length, end: m.index + m[1].length + a.length, len: a.length, exact: a === lc(cn).replace(/\(.*?\)/g, '').trim(), colLen: cn.length });
    }));
    cands.forEach(c => { c.pri = (c.exact ? 1000 : 0) + c.len - c.colLen * 0.01; });
    cands.sort((a, b) => b.pri - a.pri);
    const taken = [], usedCols = new Set(), chosen = [];
    cands.forEach(c => { if (usedCols.has(c.col) || taken.some(t => c.start < t.end && c.end > t.start)) return; taken.push(c); usedCols.add(c.col); chosen.push(c); });
    chosen.sort((a, b) => a.start - b.start).forEach(c => { if (!found.includes(c.col)) found.push(c.col); });
  });
  q.group = found.slice(0, 3);

  // filter
  const ff = findFilters(ds, text, orig, q.group);
  q.filters = ff.filters.filter(f => !(q.group.includes(f.col) && f.vals.length === distinct(ds, f.col).length));

  // tecken
  if (/minskar|minska|minskning|minskningar|besparing|neddragning|reducer|sänker|dra ner|dras ner|färre/.test(text)) q.sign = 'neg';
  else if (/ökar|öka|ökning|ökningar|tillkommer|fler\b/.test(text) && q.agg !== 'count') q.sign = 'pos';

  // topp-N
  const mt = text.match(/\b(?:topp|top)\s*(\d+)\b/);
  if (mt) q.limit = +mt[1];

  // läge
  const listy = /^\s*(vilka|visa|lista|vilken|vilket|vad|beskriv|ge mig|finns)/.test(text) && !/hur\s+många/.test(text);
  if (!q.measure || (listy && !q.group.length)) q.mode = 'list';
  if (q.mode === 'list') {
    const used = [...ff.spans.map(s => [s.start, s.end])];
    const words = text.replace(/[^a-zåäö0-9\s\/-]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !STOP.has(w));
    const skip = new Set();
    ds.columns.forEach(c => aliasesFor(c.name).forEach(a => a.split(/\s+/).forEach(x => skip.add(x))));
    (HINTS[ds.id] ? HINTS[ds.id].words : []).forEach(w => skip.add(w));
    ff.spans.forEach(s => text.slice(s.start, s.end).split(/\s+/).forEach(w => skip.add(w)));
    'åtgärder åtgärd minskar minska ser vilka visa lista bedömning ge mig finns mest flest störst högst minst lägst'.split(' ').forEach(w => skip.add(w));
    q.search = words.filter(w => !skip.has(w) && ![...skip].some(k => k.length >= 4 && (w.startsWith(k) || k.startsWith(w)))).join(' ');
  }
  return q;
}
function prep0() { state.datasets.forEach(prep); }

/* ============================================================ körning */
function getDs(id) { return state.datasets.find(d => d.id === id); }

function runQuery(q) {
  const ds = prep(getDs(q.ds));
  const mi = q.measure ? ds.colIdx[q.measure] : -1;
  const res = { q, ds, notes: [], warn: [] };
  const fidx = q.filters.map(f => ({ i: ds.colIdx[f.col], set: new Set(f.vals) }));
  let rows = ds.rows.filter(r => fidx.every(f => f.set.has(r[f.i])));
  if (q.search) {
    const ws = q.search.split(/\s+/).filter(Boolean);
    const hit = rows.filter(r => ws.some(w => r.some(c => c != null && lc(c).includes(w.slice(0, Math.max(5, w.length - 2))))));
    if (hit.length) { rows = hit; res.notes.push('Sökord: ' + ws.join(', ')); } else if (q.mode === 'list') res.notes.push('Inga rader matchade sökorden (' + ws.join(', ') + ') – visar utan sökfilter.');
  }
  if (mi >= 0 && q.sign) {
    const keep = r => q.sign === 'neg' ? (r[mi] || 0) < 0 : (r[mi] || 0) > 0;
    const excl = rows.filter(r => !keep(r));
    const exSum = excl.reduce((a, r) => a + (r[mi] || 0), 0);
    rows = rows.filter(keep);
    if (excl.some(r => r[mi])) res.notes.push(`Endast rader med ${q.sign === 'neg' ? 'minskning' : 'ökning'} är med. Exkluderade motsatta rader: ${excl.filter(r => r[mi]).length} st, netto ${fmt(exSum)}.`);
  }
  // varningar om blandade tidsdimensioner
  if (q.mode === 'agg' && q.agg === 'sum') {
    ds.dimCols.filter(isTimeCol).forEach(cn => {
      if (q.group.includes(cn)) return;
      const f = q.filters.find(x => x.col === cn);
      const vals = new Set(); const ci = ds.colIdx[cn];
      rows.forEach(r => vals.add(r[ci]));
      if (vals.size > 1 && /prognostillfälle|år|månad/i.test(cn) && !/tidplan/i.test(cn)) {
        res.warn.push({ col: cn, vals: [...vals].sort() });
      }
    });
  }
  res.nRows = rows.length;

  if (q.mode === 'list') {
    let cols = ds.columns.map(c => c.name);
    let data = rows;
    if (mi >= 0 && q.sign) data = data.slice().sort((a, b) => q.sign === 'neg' ? (a[mi] || 0) - (b[mi] || 0) : (b[mi] || 0) - (a[mi] || 0));
    if (q.limit) data = data.slice(0, q.limit);
    res.kind = 'list'; res.cols = cols; res.data = data; res.total = rows.length;
    return res;
  }

  const gi = q.group.map(g => ds.colIdx[g]);
  const agg = { sum: (a, v) => a + v, count: (a) => a + 1, max: (a, v) => Math.max(a, v), min: (a, v) => Math.min(a, v) };
  const cells = new Map();
  for (const r of rows) {
    const key = gi.map(i => r[i] == null || r[i] === '' ? '(saknas)' : r[i]);
    const k = JSON.stringify(key);
    let c = cells.get(k); if (!c) { c = { key, sum: 0, n: 0, max: -Infinity, min: Infinity }; cells.set(k, c); }
    const v = mi >= 0 ? r[mi] : null;
    c.n++; if (typeof v === 'number') { c.sum += v; if (v > c.max) c.max = v; if (v < c.min) c.min = v; }
  }
  const val = c => q.agg === 'count' ? c.n : q.agg === 'avg' ? (c.n ? c.sum / c.n : 0) : q.agg === 'max' ? c.max : q.agg === 'min' ? c.min : c.sum;
  const list = [...cells.values()].map(c => ({ key: c.key, v: val(c), n: c.n }));
  const all = rows.reduce((a, r) => { a.n++; const v = mi >= 0 ? r[mi] : null; if (typeof v === 'number') { a.sum += v; a.max = Math.max(a.max, v); a.min = Math.min(a.min, v); } return a; }, { n: 0, sum: 0, max: -Infinity, min: Infinity });
  res.grand = val(all); res.grandN = all.n;
  res.kind = 'agg'; res.list = list;
  const natural = (a, b) => String(a).localeCompare(String(b), 'sv', { numeric: true });
  if (q.group.length === 0) { res.kind = 'single'; return res; }
  if (q.group.length >= 2) {
    const rowKeys = [...new Set(list.map(x => x.key[0]))];
    const colKeys = [...new Set(list.map(x => x.key.slice(1).join(' · ')))].sort(natural);
    const m = new Map(); list.forEach(x => m.set(x.key[0] + '\u0001' + x.key.slice(1).join(' · '), x.v));
    const rt = new Map(); rowKeys.forEach(rk => {
      const items = list.filter(x => x.key[0] === rk);
      const sub = items.reduce((a, x) => { a.n += x.n; a.sum += x.v * (q.agg === 'avg' ? x.n : 1); return a; }, { n: 0, sum: 0 });
      rt.set(rk, q.agg === 'avg' ? (sub.n ? sub.sum / sub.n : 0) : q.agg === 'max' ? Math.max(...items.map(x => x.v)) : q.agg === 'min' ? Math.min(...items.map(x => x.v)) : items.reduce((a, x) => a + x.v, 0));
    });
    const timeFirst = isTimeCol(q.group[0]);
    rowKeys.sort(timeFirst ? natural : (a, b) => Math.abs(rt.get(b)) - Math.abs(rt.get(a)));
    const ct = new Map(); colKeys.forEach(ck => {
      const items = list.filter(x => x.key.slice(1).join(' · ') === ck);
      ct.set(ck, q.agg === 'avg' ? items.reduce((a, x) => a + x.v * x.n, 0) / Math.max(1, items.reduce((a, x) => a + x.n, 0)) : q.agg === 'max' ? Math.max(...items.map(x => x.v)) : q.agg === 'min' ? Math.min(...items.map(x => x.v)) : items.reduce((a, x) => a + x.v, 0));
    });
    res.kind = 'pivot'; res.rowKeys = rowKeys; res.colKeys = colKeys; res.m = m; res.rt = rt; res.ct = ct;
    if (q.limit) res.rowKeys = res.rowKeys.slice(0, q.limit);
    return res;
  }
  const timeFirst = isTimeCol(q.group[0]);
  list.sort(timeFirst ? (a, b) => natural(a.key[0], b.key[0]) : (q.sign === 'neg' ? (a, b) => a.v - b.v : (a, b) => Math.abs(b.v) - Math.abs(a.v)));
  res.list = q.limit ? list.slice(0, q.limit) : list;
  return res;
}

/* ============================================================ rendering */
function describe(q) {
  const ds = getDs(q.ds);
  const aggTxt = { sum: 'Summa', avg: 'Medelvärde', count: 'Antal rader', max: 'Maximum', min: 'Minimum' }[q.agg];
  const parts = [`Källa <b>${esc(ds.name)}</b>`];
  if (q.mode === 'list') parts.push('<b>lista rader</b>');
  else parts.push(q.agg === 'count' ? `<b>${aggTxt}</b>` : `${aggTxt} av <b>${esc(q.measure)}</b>`);
  if (q.group.length) parts.push('per ' + q.group.map(g => `<b>${esc(g)}</b>`).join(' × '));
  q.filters.forEach(f => parts.push(`${esc(f.col)} = <b>${f.vals.map(esc).join(' / ')}</b>`));
  if (q.sign) parts.push(`endast <b>${q.sign === 'neg' ? 'minskningar' : 'ökningar'}</b>`);
  if (q.limit) parts.push(`topp ${q.limit}`);
  return parts.join(' · ');
}
function titleOf(q) {
  const aggTxt = { sum: 'Summa', avg: 'Medel', count: 'Antal rader', max: 'Max', min: 'Min' }[q.agg];
  if (q.mode === 'list') return 'Rader ur ' + getDs(q.ds).name;
  return `${q.agg === 'count' ? aggTxt : aggTxt + ' ' + q.measure}${q.group.length ? ' per ' + q.group.join(' × ') : ''}`;
}
const cls = v => v < -0.0049 ? 'neg' : v > 0.0049 ? 'pos' : '';

function render(res) {
  state.lastResult = res;
  const q = res.q, el = $('#result');
  let body = '';
  const hasChart = res.kind === 'agg' || res.kind === 'pivot';
  if (res.kind === 'list') {
    const ds = res.ds, ci = res.cols.map(c => ds.colIdx[c]);
    const show = res.data.slice(0, 500);
    body = `<div class="tw"><table><thead><tr>${res.cols.map(c => `<th class="${ds.columns[ds.colIdx[c]].type === 'num' ? 'num' : ''}">${esc(c)}</th>`).join('')}</tr></thead><tbody>` +
      show.map(r => '<tr>' + ci.map((i, k) => { const v = r[i], c = ds.columns[i]; return c.type === 'num' ? `<td class="num ${cls(v)}">${fmt(v)}</td>` : `<td class="${c.role === 'text' ? 'txt' : ''}">${esc(v)}</td>`; }).join('') + '</tr>').join('') +
      `</tbody></table></div>`;
    if (res.total > 500) body += `<div class="note">Visar 500 av ${res.total} rader. Exportera CSV för alla.</div>`;
    if (!show.length) body = '<div class="empty">Inga rader matchar.</div>';
  } else if (res.kind === 'single') {
    body = `<div class="empty" style="font-size:30px;color:var(--ink)">${fmt(res.grand)}<div style="font-size:13px;color:var(--muted)">${esc(q.agg === 'count' ? 'rader' : q.measure)} · ${res.grandN} rader</div></div>`;
  } else if (state.view === 'chart' && hasChart) {
    body = barsHtml(res);
  } else if (res.kind === 'agg') {
    body = `<div class="tw"><table><thead><tr><th>${esc(q.group[0])}</th><th class="num">${esc(q.agg === 'count' ? 'Antal rader' : q.measure)}</th><th class="num">Rader</th></tr></thead><tbody>` +
      res.list.map(x => `<tr><td>${esc(x.key[0])}</td><td class="num ${cls(x.v)}">${fmt(x.v)}</td><td class="num muted">${x.n}</td></tr>`).join('') +
      `<tr class="tot"><td>Totalt</td><td class="num ${cls(res.grand)}">${fmt(res.grand)}</td><td class="num">${res.grandN}</td></tr></tbody></table></div>`;
  } else if (res.kind === 'pivot') {
    const mx = Math.max(1e-9, ...[...res.m.values()].map(Math.abs));
    const shade = v => v ? `style="background:color-mix(in srgb, ${v < 0 ? 'var(--bar-neg)' : 'var(--bar-pos)'} ${Math.round(Math.min(1, Math.abs(v) / mx) * 38)}%, transparent)"` : '';
    body = `<div class="tw"><table><thead><tr><th>${esc(q.group[0])} \\ ${esc(q.group.slice(1).join(' · '))}</th>${res.colKeys.map(c => `<th class="num">${esc(c)}</th>`).join('')}<th class="num">Totalt</th></tr></thead><tbody>` +
      res.rowKeys.map(rk => `<tr><td>${esc(rk)}</td>${res.colKeys.map(ck => { const v = res.m.get(rk + '\u0001' + ck); return `<td class="num ${cls(v)}" ${shade(v)}>${v == null ? '' : fmt(v)}</td>`; }).join('')}<td class="num ${cls(res.rt.get(rk))}"><b>${fmt(res.rt.get(rk))}</b></td></tr>`).join('') +
      `<tr class="tot"><td>Totalt</td>${res.colKeys.map(ck => `<td class="num ${cls(res.ct.get(ck))}">${fmt(res.ct.get(ck))}</td>`).join('')}<td class="num ${cls(res.grand)}">${fmt(res.grand)}</td></tr></tbody></table></div>`;
  }
  const notes = res.notes.map(n => `<div class="note">${esc(n)}</div>`).join('') +
    res.warn.map(w => `<div class="note warn">⚠ Resultatet summerar över flera värden i <b>${esc(w.col)}</b> (${w.vals.slice(0, 8).map(esc).join(', ')}${w.vals.length > 8 ? '…' : ''}). Det blandar ${/tillfälle/i.test(w.col) ? 'olika versioner av samma prognos' : 'olika perioder'}. Begränsa till: ${w.vals.slice(0, 10).map(v => `<button data-f="${esc(w.col)}" data-v="${esc(v)}">${esc(v)}</button>`).join(' ')}</div>`).join('');
  el.innerHTML = `<div class="card res"><div class="head"><h3>${esc(titleOf(q))}</h3>
    <span class="muted">${res.nRows} rader i urvalet</span>
    <button id="btnCsv">Exportera CSV</button></div>
    ${hasChart ? `<div class="tabs"><button data-view="table" class="${state.view === 'table' ? 'on' : ''}">Tabell</button><button data-view="chart" class="${state.view === 'chart' ? 'on' : ''}">Diagram</button></div>` : ''}
    ${notes}${body}</div>`;
  $('#btnCsv').onclick = () => exportCsv(res);
  el.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { state.view = b.dataset.view; render(res); });
  el.querySelectorAll('.warn button').forEach(b => b.onclick = () => {
    const f = q.filters.find(x => x.col === b.dataset.f);
    if (f) f.vals = [b.dataset.v]; else q.filters.push({ col: b.dataset.f, vals: [b.dataset.v] });
    syncBuilder(); go(q);
  });
}

function barsHtml(res) {
  const rows = res.kind === 'pivot' ? res.rowKeys.map(k => ({ l: k, v: res.rt.get(k) })) : res.list.map(x => ({ l: x.key[0], v: x.v }));
  const mn = Math.min(0, ...rows.map(r => r.v)), mx = Math.max(0, ...rows.map(r => r.v)), span = (mx - mn) || 1;
  const zero = (-mn / span) * 100;
  return '<div class="bars">' + rows.map(r => {
    const left = r.v < 0 ? ((r.v - mn) / span) * 100 : zero, w = Math.abs(r.v) / span * 100;
    return `<div class="bar"><div class="l" title="${esc(r.l)}">${esc(r.l)}</div><div class="t"><i style="left:${left}%;width:${w}%;background:${r.v < 0 ? 'var(--bar-neg)' : 'var(--bar-pos)'}"></i><u style="left:${zero}%"></u></div><div class="v ${cls(r.v)}">${fmt(r.v)}</div></div>`;
  }).join('') + (res.kind === 'pivot' ? `<div class="muted" style="margin-top:6px;font-size:12px">Stapeln visar radsumma över ${esc(res.q.group.slice(1).join(' · '))}. Se tabellen för fördelningen.</div>` : '') + '</div>';
}

function exportCsv(res) {
  let out = [];
  const q = res.q;
  if (res.kind === 'list') { out.push(res.cols); res.data.forEach(r => out.push(res.cols.map(c => r[res.ds.colIdx[c]]))); }
  else if (res.kind === 'agg') { out.push([q.group[0], q.measure || 'Antal', 'Rader']); res.list.forEach(x => out.push([x.key[0], x.v, x.n])); out.push(['Totalt', res.grand, res.grandN]); }
  else if (res.kind === 'pivot') { out.push([q.group[0], ...res.colKeys, 'Totalt']); res.rowKeys.forEach(rk => out.push([rk, ...res.colKeys.map(ck => res.m.get(rk + '\u0001' + ck) ?? ''), res.rt.get(rk)])); out.push(['Totalt', ...res.colKeys.map(ck => res.ct.get(ck)), res.grand]); }
  else out.push([q.measure, res.grand]);
  const csv = out.map(r => r.map(v => { v = v == null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = titleOf(q).replace(/[^\wåäöÅÄÖ-]+/g, '_') + '.csv'; a.click();
}

/* ============================================================ builder */
function syncBuilder() {
  const q = state.q; if (!q) return;
  const ds = prep(getDs(q.ds));
  const opt = (arr, sel, empty) => (empty ? `<option value="">${empty}</option>` : '') + arr.map(x => `<option value="${esc(x)}" ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');
  const b = $('#builder');
  b.innerHTML = `
    <div><label>Datakälla</label><select id="bDs">${state.datasets.map(d => `<option value="${esc(d.id)}" ${d.id === q.ds ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div>
    <div><label>Läge</label><select id="bMode"><option value="agg" ${q.mode === 'agg' ? 'selected' : ''}>Sammanställ</option><option value="list" ${q.mode === 'list' ? 'selected' : ''}>Lista rader</option></select></div>
    <div><label>Mått</label><select id="bMeasure">${opt(ds.numCols, q.measure, ds.numCols.length ? '' : '(inga numeriska kolumner)')}</select></div>
    <div><label>Beräkning</label><select id="bAgg">${[['sum', 'Summa'], ['avg', 'Medelvärde'], ['count', 'Antal rader'], ['max', 'Max'], ['min', 'Min']].map(([v, t]) => `<option value="${v}" ${q.agg === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    ${[0, 1, 2].map(i => `<div><label>Gruppera ${i + 1}</label><select class="bGrp" data-i="${i}">${opt(ds.dimCols, q.group[i], '—')}</select></div>`).join('')}
    <div><label>Teckenfilter</label><select id="bSign"><option value="">Alla</option><option value="neg" ${q.sign === 'neg' ? 'selected' : ''}>Endast minskningar (&lt; 0)</option><option value="pos" ${q.sign === 'pos' ? 'selected' : ''}>Endast ökningar (&gt; 0)</option></select></div>
    <div><label>Topp N</label><input type="text" id="bLimit" value="${q.limit || ''}" placeholder="alla"></div>
    <div><label>Sökord (fritext)</label><input type="text" id="bSearch" value="${esc(q.search)}" placeholder="t.ex. risk"></div>
    <div class="filters"><label>Filter</label><div id="fchips">${q.filters.map((f, i) => `<span class="fchip">${esc(f.col)}: ${f.vals.map(esc).join(' / ')}<button data-rm="${i}">✕</button></span>`).join('')}</div>
      <div class="row"><select id="fCol" style="max-width:230px">${opt(ds.dimCols, null, 'Lägg till filter på…')}</select><select id="fVal" multiple style="display:none;min-width:240px;height:90px"></select><button id="fAdd" style="display:none">Lägg till</button></div></div>`;
  $('#bDs').onchange = e => { const nq = { ...blank(e.target.value) }; state.q = nq; syncBuilder(); go(nq); };
  const upd = () => {
    q.mode = $('#bMode').value; q.measure = $('#bMeasure').value || null; q.agg = $('#bAgg').value;
    q.group = [...document.querySelectorAll('.bGrp')].map(s => s.value).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
    q.sign = $('#bSign').value || null; q.limit = parseInt($('#bLimit').value) || null; q.search = $('#bSearch').value.trim();
    go(q);
  };
  ['bMode', 'bMeasure', 'bAgg', 'bSign'].forEach(id => $('#' + id).onchange = upd);
  document.querySelectorAll('.bGrp').forEach(s => s.onchange = upd);
  $('#bLimit').onchange = upd; $('#bSearch').onchange = upd;
  b.querySelectorAll('[data-rm]').forEach(x => x.onclick = () => { q.filters.splice(+x.dataset.rm, 1); syncBuilder(); go(q); });
  $('#fCol').onchange = e => {
    const c = e.target.value, sel = $('#fVal');
    if (!c) { sel.style.display = 'none'; $('#fAdd').style.display = 'none'; return; }
    sel.innerHTML = distinct(ds, c).slice(0, 800).sort((a, b) => String(a).localeCompare(String(b), 'sv', { numeric: true })).map(v => `<option>${esc(v)}</option>`).join('');
    sel.style.display = ''; $('#fAdd').style.display = '';
  };
  $('#fAdd').onclick = () => {
    const c = $('#fCol').value, vals = [...$('#fVal').selectedOptions].map(o => o.value);
    if (!c || !vals.length) return;
    const real = distinct(ds, c).filter(v => vals.includes(String(v)));
    const ex = q.filters.find(f => f.col === c); if (ex) ex.vals = real; else q.filters.push({ col: c, vals: real });
    syncBuilder(); go(q);
  };
}
function blank(dsId) {
  const ds = prep(getDs(dsId)), h = HINTS[dsId] || {};
  return { ds: dsId, measure: (h.measure && ds.colIdx[h.measure] != null) ? h.measure : (ds.numCols[ds.numCols.length - 1] || null), agg: 'sum', group: [], filters: [], sign: null, mode: ds.numCols.length ? 'agg' : 'list', limit: null, search: '' };
}

/* ============================================================ flöde */
function go(q) {
  state.q = q; state.active = q.ds;
  $('#interp').style.display = ''; $('#interp').innerHTML = '<b>Tolkning:</b> ' + describe(q) + ' <span class="muted">– fel tolkat? Öppna “Justera frågan”.</span>';
  renderDsList();
  try { render(runQuery(q)); } catch (e) { $('#result').innerHTML = `<div class="card empty warn">Kunde inte köra frågan: ${esc(e.message)}</div>`; console.error(e); }
}
function ask() {
  const t = $('#q').value.trim(); if (!t) return;
  const q = parseQuestion(t, getDs(state.active));
  syncBuilder(); go(q);
}

/* ============================================================ datakällelista */
function renderDsList() {
  const el = $('#dsList');
  el.innerHTML = state.datasets.map(d => `<div class="ds ${d.id === state.active ? 'active' : ''}" data-id="${esc(d.id)}"><div><div class="n">${esc(d.name)}</div><div class="m">${d.rows.length.toLocaleString('sv-SE')} rader · ${esc(d.source)}</div></div>${d.uploaded ? `<button class="ghost x" data-del="${esc(d.id)}" title="Ta bort">✕</button>` : ''}</div>`).join('');
  el.querySelectorAll('.ds').forEach(n => n.onclick = e => {
    if (e.target.dataset.del) return;
    state.active = n.dataset.id; showInfo(); renderDsList();
    if (state.q) { const nq = blank(state.active); syncBuilder.call(null); state.q = nq; syncBuilder(); go(nq); }
  });
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Ta bort datakällan?')) return;
    state.datasets = state.datasets.filter(d => d.id !== b.dataset.del);
    if (state.active === b.dataset.del) state.active = state.datasets[0].id;
    await persist(); renderDsList(); showInfo();
  });
  showInfo();
}
function showInfo() {
  const ds = getDs(state.active); if (!ds) return; prep(ds);
  const el = $('#dsInfo'); el.style.display = '';
  el.innerHTML = `<h2>Om vald källa</h2><div class="cols" style="color:var(--ink)">${esc(ds.desc || '')}</div>
    <div class="cols"><b>Kolumner:</b> ${ds.columns.map(c => `${esc(c.name)}${c.type === 'num' ? ' <span title="numerisk">#</span>' : ''}`).join(' · ')}</div>
    <div class="cols"><button id="btnRows">Visa rader</button></div>`;
  $('#btnRows').onclick = () => { const q = blank(ds.id); q.mode = 'list'; state.q = q; syncBuilder(); go(q); };
}

/* ============================================================ persistens (IndexedDB) */
function idb() {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open('bemanningsanalys', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
}
async function persist() {
  try {
    const db = await idb(), up = state.datasets.filter(d => d.uploaded).map(d => ({ id: d.id, name: d.name, source: d.source, desc: d.desc, columns: d.columns, rows: d.rows, uploaded: true }));
    await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(up, 'uploaded'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  } catch (e) { console.warn('Kunde inte spara lokalt', e); }
}
async function restore() {
  try {
    const db = await idb();
    return await new Promise((res, rej) => { const r = db.transaction('kv').objectStore('kv').get('uploaded'); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); });
  } catch (e) { return []; }
}

/* ============================================================ import av Excel */
const PERIOD_RE = /^((19|20)\d{2})([-\/ ]?(0[1-9]|1[0-2]))?$/;

function cellStr(v) {
  if (v == null) return '';
  if (v instanceof Date) { const d = new Date(v.getTime() + 12 * 3600e3); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  return String(v).trim();
}
function normCell(v) {
  if (v == null) return null;
  if (v instanceof Date) return cellStr(v);
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nej';
  let s = String(v).trim(); if (s === '') return null;
  if (/^-?\d+([.,]\d+)?$/.test(s) && !/^0\d/.test(s)) return parseFloat(s.replace(',', '.'));
  return s;
}
function detectHeader(aoa) {
  const n = Math.min(aoa.length, 60), cnt = aoa.slice(0, n).map(r => r.filter(c => c != null && c !== '').length);
  const cand = [];
  for (let i = 0; i < n - 1; i++) {
    const r = aoa[i], c = cnt[i];
    if (c < 2) continue;
    const strish = r.filter(x => (typeof x === 'string' && x.length < 80) || PERIOD_RE.test(cellStr(x))).length;
    if (strish < 0.7 * c) continue;
    if (cnt[i + 1] >= 0.4 * c) cand.push(i);
  }
  if (!cand.length) return 0;
  const mx = Math.max(...cand.map(i => cnt[i]));
  return cand.find(i => cnt[i] >= 0.85 * mx);
}
function monthNorm(h) { const m = String(h).match(PERIOD_RE); if (!m) return null; return m[4] ? `${m[1]}-${m[4]}` : m[1]; }

function buildDataset(aoa, opt) {
  aoa = aoa.map(r => r.map(normCell));
  const hi = opt.headerRow != null ? opt.headerRow : detectHeader(aoa);
  const head = aoa[hi] || [], width = Math.max(...aoa.slice(hi, hi + 200).map(r => r.length), head.length);
  const grp = hi > 0 ? aoa[hi - 1] : null;
  let useGrp = false;
  if (grp) {
    const ne = grp.filter(x => x != null).length, nh = head.filter(x => x != null).length;
    useGrp = ne >= 2 && ne <= nh / 2 && grp.every(x => x == null || (typeof x === 'string' && x.length < 40) || PERIOD_RE.test(cellStr(x)));
  }
  const names = []; let last = null;
  for (let j = 0; j < width; j++) {
    let h = head[j] != null ? cellStr(head[j]) : '';
    if (useGrp) { if (grp[j] != null) last = cellStr(grp[j]); }
    if (useGrp && last && h && last !== h) h = last + ' – ' + h;
    names.push(h);
  }
  const body = aoa.slice(hi + 1).filter(r => r.some(c => c != null));
  const keep = [];
  for (let j = 0; j < width; j++) if (names[j] || body.some(r => r[j] != null)) keep.push(j);
  const seen = {}, cols = keep.map(j => { let n = names[j] || 'Kolumn ' + (j + 1); if (seen[n]) { seen[n]++; n += ' (' + seen[n] + ')'; } else seen[n] = 1; return { j, name: n }; });
  let data = body;
  if (opt.dropTotals) data = data.filter(r => { const f = r.find(c => typeof c === 'string'); return !(f && /^(total|totalt|totalsumma|summa|sum|delsumma|slutsumma)\b/i.test(f)); });

  // unpivot av period-kolumner
  const per = cols.filter(c => monthNorm(head[c.j] != null ? cellStr(head[c.j]) : (useGrp ? '' : '')) || (head[c.j] != null && PERIOD_RE.test(cellStr(head[c.j]))));
  let outCols, outRows, unp = false;
  if (opt.unpivot && per.length >= 3) {
    unp = true;
    const perSet = new Set(per.map(c => c.j)), ids = cols.filter(c => !perSet.has(c.j));
    outCols = [...ids.map(c => ({ name: c.name })), { name: 'Period', type: 'text' }, { name: 'Värde', type: 'num' }];
    outRows = [];
    for (const r of data) {
      const base = ids.map(c => r[c.j] == null ? null : r[c.j]);
      for (const p of per) { const v = r[p.j]; if (typeof v === 'number') { outRows.push([...base, monthNorm(cellStr(head[p.j])), v]); if (outRows.length > 600000) break; } }
      if (outRows.length > 600000) break;
    }
    outCols.forEach((c, i) => { if (!c.type) c.type = 'text'; });
    // typa id-kolumner
    ids.forEach((c, i) => { const vals = outRows.slice(0, 5000).map(r => r[i]).filter(v => v != null); outCols[i].type = vals.length && vals.filter(v => typeof v === 'number').length / vals.length >= 0.8 ? 'num' : 'text'; });
  } else {
    outCols = cols.map(c => ({ name: c.name })); outRows = data.map(r => cols.map(c => r[c.j] == null ? null : r[c.j]));
    outCols.forEach((c, i) => { const vals = outRows.map(r => r[i]).filter(v => v != null); c.type = vals.length && vals.filter(v => typeof v === 'number').length / vals.length >= 0.8 ? 'num' : 'text'; });
  }
  // sanera blandade värden
  outCols.forEach((c, i) => { if (c.type === 'num') outRows.forEach(r => { if (typeof r[i] !== 'number') r[i] = null; else r[i] = Math.round(r[i] * 10000) / 10000; }); else outRows.forEach(r => { if (r[i] != null) r[i] = String(r[i]); }); });
  inferRoles(outCols, outRows);
  // "År"/"Period"-kolumner med få värden ska vara dimensioner även om numeriska
  outCols.forEach((c, i) => { if (c.type === 'num' && /^(år|period|månad|nr|resursnr)$/i.test(c.name)) { c.type = 'text'; c.role = 'dim'; outRows.forEach(r => { if (r[i] != null) r[i] = String(r[i]); }); } });
  return { columns: outCols, rows: outRows, unpivoted: unp, headerRow: hi };
}

let pending = null; // {file, buf, sheets:[{name, aoa, opts}]}

async function readFile(file) {
  const buf = await file.arrayBuffer();
  if (/\.csv$/i.test(file.name)) {
    let text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { text = new TextDecoder('windows-1252').decode(buf); }
    return { file, csv: text };
  }
  return { file, buf };
}
function aoaOf(wb, name) { return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false }); }

async function openImport(files) {
  const dlg = $('#dlg'), B = $('#dlgB');
  $('#dlgH').textContent = 'Läs in Excel'; B.innerHTML = '<p class="muted">Läser filer… (stora filer kan ta en stund)</p>';
  if (!dlg.open) dlg.showModal();
  pending = [];
  for (const f of files) {
    await new Promise(r => setTimeout(r, 30));
    try {
      const src = await readFile(f);
      const wb = src.csv != null ? XLSX.read(src.csv, { type: 'string', cellDates: true, sheetRows: 80 }) : XLSX.read(src.buf, { type: 'array', cellDates: true, sheetRows: 80 });
      src.sheets = wb.SheetNames.map(n => { const aoa = aoaOf(wb, n); const ds = buildDataset(aoa, { dropTotals: true, unpivot: true }); return { name: n, aoa, ok: aoa.length >= 3 && ds.columns.length >= 2 && ds.rows.length >= 2, pv: ds, headerRow: ds.headerRow }; });
      pending.push(src);
    } catch (e) { pending.push({ file: f, err: e.message, sheets: [] }); }
  }
  B.innerHTML = pending.map((src, fi) => `<h3 style="margin:0 0 8px">${esc(src.file.name)}</h3>` + (src.err ? `<p class="warn">Kunde inte läsa: ${esc(src.err)}</p>` : src.sheets.map((sh, si) => {
    const pv = sh.pv, perN = pv.columns.length;
    return `<div class="sheet"><div class="sh"><input type="checkbox" data-f="${fi}" data-s="${si}" class="sel" ${sh.ok ? 'checked' : ''}> <input type="text" class="nm" value="${esc(src.sheets.length > 1 || true ? shortName(src.file.name) + ' › ' + sh.name : sh.name)}"></div>
      <div class="opts"><label>Rubrikrad <input type="number" class="hr" min="1" style="width:56px" value="${sh.headerRow + 1}"></label>
      <label><input type="checkbox" class="unp" ${pv.unpivoted ? 'checked' : ''}> Gör om år/månadskolumner till rader</label>
      <label><input type="checkbox" class="drt" checked> Hoppa över summarader</label></div>
      <div class="pv">${previewTable(pv)}</div></div>`;
  }).join(''))).join('');
  const sheetsFlat = pending.flatMap(s => s.sheets);
  B.querySelectorAll('.sheet').forEach((box, k) => {
    const redo = () => {
      const sh = sheetsFlat[k];
      const pv = buildDataset(sh.aoa, { headerRow: (parseInt(box.querySelector('.hr').value) || 1) - 1, unpivot: box.querySelector('.unp').checked, dropTotals: box.querySelector('.drt').checked });
      box.querySelector('.pv').innerHTML = previewTable(pv);
    };
    box.querySelectorAll('.hr,.unp,.drt').forEach(i => i.addEventListener('change', redo));
  });
  $('#dlgOk').onclick = () => finishImport();
  $('#dlgCancel').onclick = () => dlg.close();
}
function shortName(n) { return n.replace(/\.[^.]+$/, '').replace(/^[0-9a-f]{8}-/, '').replace(/_/g, ' ').slice(0, 42); }
function previewTable(pv) {
  return '<table><thead><tr>' + pv.columns.slice(0, 10).map(c => `<th>${esc(c.name.slice(0, 26))}</th>`).join('') + '</tr></thead><tbody>' +
    pv.rows.slice(0, 4).map(r => '<tr>' + pv.columns.slice(0, 10).map((c, i) => `<td>${esc(String(r[i] ?? '').slice(0, 26))}</td>`).join('') + '</tr>').join('') + '</tbody></table>';
}
async function finishImport() {
  const B = $('#dlgB'); const boxes = [...B.querySelectorAll('.sheet')];
  const wanted = []; let idx = 0;
  pending.forEach((src, fi) => src.sheets.forEach((sh, si) => {
    const box = boxes[idx++];
    if (!box.querySelector('.sel').checked) return;
    wanted.push({ src, sh, name: box.querySelector('.nm').value.trim() || sh.name, hr: (parseInt(box.querySelector('.hr').value) || 1) - 1, unp: box.querySelector('.unp').checked, drt: box.querySelector('.drt').checked });
  }));
  if (!wanted.length) { $('#dlg').close(); return; }
  B.innerHTML = '<p class="muted">Läser in valda blad…</p>'; $('#dlgOk').disabled = true;
  const added = [];
  for (const [src, items] of groupBy(wanted, w => w.src)) {
    await new Promise(r => setTimeout(r, 30));
    const names = items.map(i => i.sh.name);
    const wb = src.csv != null ? XLSX.read(src.csv, { type: 'string', cellDates: true }) : XLSX.read(src.buf, { type: 'array', cellDates: true, sheets: names, sheetRows: 60000 });
    for (const it of items) {
      await new Promise(r => setTimeout(r, 10));
      const built = buildDataset(aoaOf(wb, it.sh.name), { headerRow: it.hr, unpivot: it.unp, dropTotals: it.drt });
      if (!built.rows.length) continue;
      const base = it.name.replace(/[^\wåäöÅÄÖ]+/g, '_').toLowerCase(); let id = 'up_' + base, k = 1;
      while (state.datasets.some(d => d.id === id)) id = 'up_' + base + '_' + (++k);
      added.push({ id, name: it.name, source: src.file.name, desc: 'Uppladdad fil. ' + (built.unpivoted ? 'År/månadskolumner är omvandlade till kolumnerna Period och Värde.' : ''), columns: built.columns, rows: built.rows, uploaded: true });
    }
  }
  state.datasets.push(...added);
  await persist();
  $('#dlgOk').disabled = false; $('#dlg').close();
  if (added.length) { state.active = added[0].id; renderDsList(); const q = blank(state.active); syncBuilder.call(null); state.q = q; syncBuilder(); go(q); }
}
function groupBy(arr, fn) { const m = new Map(); arr.forEach(x => { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return m; }

/* ============================================================ init */
async function init() {
  state.datasets = (window.PRELOADED || []).map(d => ({ ...d }));
  const up = await restore();
  up.forEach(d => { if (!state.datasets.some(x => x.id === d.id)) state.datasets.push(d); });
  state.active = 'atgarder';
  state.datasets.forEach(prep);
  renderDsList();
  $('#examples').innerHTML = EXAMPLES.map(e => `<button>${esc(e)}</button>`).join('');
  $('#examples').querySelectorAll('button').forEach(b => b.onclick = () => { $('#q').value = b.textContent; ask(); });
  $('#btnAsk').onclick = ask;
  $('#q').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } });
  $('#btnBuilder').onclick = () => {
    if (!state.q) { state.q = blank(state.active); syncBuilder(); go(state.q); }
    state.builderOpen = !state.builderOpen; $('#builder').style.display = state.builderOpen ? '' : 'none';
    $('#btnBuilder').textContent = state.builderOpen ? 'Dölj justering ▴' : 'Justera frågan ▾';
  };
  $('#btnUpload').onclick = () => $('#file').click();
  $('#file').onchange = e => { if (e.target.files.length) openImport([...e.target.files]); e.target.value = ''; };
  const drop = $('#drop');
  ['dragover', 'dragenter'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => { if (ev === 'dragleave' && e.relatedTarget) return; drop.classList.remove('over'); }));
  document.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files.length) openImport([...e.dataTransfer.files]); });
  drop.onclick = () => $('#file').click();
  $('#btnTheme').onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const nx = cur === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = nx;
    try { localStorage.setItem('theme', nx); } catch (e) { }
  };
  try { const t = localStorage.getItem('theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) { }
  // förifyll med exempelfrågan
  $('#q').value = EXAMPLES[0]; ask();
  window.__app = { parseQuestion, runQuery, state, buildDataset };
}
init();
})();
