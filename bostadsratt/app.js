/* Gränssnitt för Ettor-appen. All beräkning ligger i calc.js. */
(function () {
  'use strict';

  var STORE_KEY = 'bostadsratt-ettor-v1';
  var C = window.Calc;
  var state = load();
  var tab = 'sim';
  var showArchive = true;

  /* ---------- Lagring ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) { /* tom eller blockerad lagring – börja från Excel-värdena */ }
    return C.defaultState();
  }
  function normalize(s) {
    var d = C.defaultState();
    s.params = Object.assign(d.params, s.params);
    s.weights = Object.assign(d.weights, s.weights);
    s.candidates = s.candidates || [];
    s.invoices = s.invoices || d.invoices;
    s.categories = s.categories || d.categories;
    return s;
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignoreras */ }
  }

  /* ---------- Formatering ---------- */
  var nf0 = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function kr(v) { return v === null || v === undefined || isNaN(v) ? '–' : nf0.format(Math.round(v)) + ' kr'; }
  function kr2(v) { return v === null || v === undefined || isNaN(v) ? '–' : nf2.format(v) + ' kr'; }
  function pct(v, d) { return v === null || v === undefined || isNaN(v) ? '–' : (v * 100).toLocaleString('sv-SE', { maximumFractionDigits: d == null ? 1 : d }) + ' %'; }
  function sc(v) { return v ? v.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–'; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function signed(v) {
    if (v === null || v === undefined) return '–';
    return '<span class="' + (v < 0 ? 'neg' : 'pos') + '">' + (v > 0 ? '+' : '') + kr(v) + '</span>';
  }
  function uid() { return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function critLabel(cr) {
    if (cr.key === 'eget1' && state.params.eget1Namn) return state.params.eget1Namn;
    if (cr.key === 'eget2' && state.params.eget2Namn) return state.params.eget2Namn;
    return cr.label;
  }

  /* ---------- Inmatningsfält kopplade till state ---------- */
  // kind: money | pct | num | text
  function toInput(v, kind) {
    if (v === '' || v === null || v === undefined) return '';
    if (kind === 'pct') return +(v * 100).toFixed(4);
    return v;
  }
  function fromInput(v, kind) {
    if (kind === 'text') return v;
    var n = C.num(v);
    if (n === null) return '';
    return kind === 'pct' ? n / 100 : n;
  }
  function field(path, kind, unit, attrs) {
    var obj = path.split('.').reduce(function (o, k) { return o[k]; }, state);
    return '<input data-bind="' + path + '" data-kind="' + kind + '" inputmode="decimal" value="' +
      esc(toInput(obj, kind)) + '"' + (attrs || '') + '>' + (unit ? '<span class="unit">' + unit + '</span>' : '');
  }
  function setPath(path, value) {
    var keys = path.split('.'), o = state;
    for (var i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys[keys.length - 1]] = value;
  }

  /* ---------- Flik: Kapital & antaganden ---------- */
  function inRow(label, path, kind, unit) {
    return '<div class="row"><label>' + label + '</label><span>' + field(path, kind, unit) + '</span></div>';
  }
  function outRow(label, key, cls) {
    return '<div class="row' + (cls ? ' ' + cls : '') + '"><span>' + label + '</span><span class="val" data-out="' + key + '"></span></div>';
  }

  function renderSim() {
    var p = state.params;
    return '<div class="grid">' +
      '<section class="card"><h2>Rådmansgatan 59 såld</h2>' +
        inRow('Försäljningspris', 'params.saljpris', 'money', 'kr') +
        inRow('Inköpspris', 'params.inkopspris', 'money', 'kr') +
        inRow('Förbättringsutgifter', 'params.forbattringar', 'money', 'kr') +
        inRow('Mäklararvode', 'params.maklarPct', 'pct', '%') +
        outRow('Mäklararvode kr', 'maklarKr') +
        inRow('Restlån som löses', 'params.restlan', 'money', 'kr') +
        outRow('Reavinst (före uppskov)', 'reavinst') +
        '<div class="notice" id="inkop-notice" hidden>Inköpspriset är 0 – då räknas hela försäljningspriset som vinst. Fyll i verkligt inköpspris för en korrekt vinstskatt.</div>' +
      '</section>' +
      '<section class="card"><h2>Karlavägen 71 köpt (ersättningsbostad)</h2>' +
        inRow('Köppris Karlavägen', 'params.karlavagenPris', 'money', 'kr') +
        inRow('Takbelopp uppskov', 'params.takbelopp', 'money', 'kr') +
        '<p class="hint">Takbeloppet gäller per person – äger ni två, ange er andel eller dubbla taket.</p>' +
        outRow('Uppskov', 'uppskov') +
        outRow('Vinstskatt som betalas nu (22 %)', 'vinstskatt') +
        outRow('Nettolikvid Rådmansgatan', 'nettolikvid') +
        inRow('Lån på Karlavägen', 'params.karlavagenLan', 'money', 'kr') +
        outRow('Kontantinsats Karlavägen', 'kontantKarlavagen') +
        outRow('Kvarvarande kapital till etta', 'kvarvarande', 'total') +
      '</section>' +
      '<section class="card"><h2>Köpkalkyl – gemensamma antaganden</h2>' +
        '<div class="row"><label><input type="checkbox" data-check="params.handpenningAuto"' + (p.handpenningAuto !== false ? ' checked' : '') +
          '> Kontantinsats = kvarvarande kapital</label></div>' +
        '<div class="row" id="hp-manual"' + (p.handpenningAuto !== false ? ' hidden' : '') + '><label>Kontantinsats (manuell)</label><span>' + field('params.handpenningManuell', 'money', 'kr') + '</span></div>' +
        outRow('Kontantinsats som används', 'kontant') +
        inRow('Standardränta', 'params.ranta', 'pct', '%') +
        inRow('Bolånetak (max belåning)', 'params.bolanetak', 'pct', '%') +
        inRow('Hushållets bruttoinkomst/år', 'params.inkomst', 'money', 'kr') +
        '<div class="row"><label><input type="checkbox" data-check="params.skarptAmortering"' + (p.skarptAmortering !== false ? ' checked' : '') +
          '> Skärpt amorteringskrav (+1 % om lån &gt; 4,5 × inkomst)</label></div>' +
        inRow('Ränteavdrag – tak för 30 %', 'params.avdragTak', 'money', 'kr/år') +
        inRow('Maxpris', 'params.maxpris', 'money', 'kr') +
      '</section>' +
      '<section class="card"><h2>Köpa vs hyra</h2>' +
        inRow('Förväntad värdeökning', 'params.vardeokning', 'pct', '%/år') +
        inRow('Avkastning på kapital (alternativkostnad)', 'params.avkastning', 'pct', '%/år') +
        '<p class="hint">Hyran för en motsvarande etta anges per lägenhet. Negativ skillnad = köp billigare än hyra.</p>' +
      '</section>' +
    '</div>';
  }

  function updateSimOutputs() {
    var r = C.evaluate(state);
    var vals = Object.assign({}, r.bg, { kontant: r.kontant });
    document.querySelectorAll('[data-out]').forEach(function (el) {
      el.textContent = kr(vals[el.getAttribute('data-out')]);
    });
    document.getElementById('inkop-notice').hidden = !!C.num(state.params.inkopspris);
  }

  /* ---------- Flik: Lägenheter ---------- */
  function renderApts() {
    var r = C.evaluate(state);
    var active = r.rows.filter(function (x) { return !x.c.arkiv; });
    var archived = r.rows.filter(function (x) { return x.c.arkiv; });
    var html = '<div class="toolbar"><button class="btn primary" data-act="add-apt">+ Lägg till lägenhet</button>' +
      '<span class="hint" style="margin:0">Kontantinsats: <b>' + kr(r.kontant) + '</b> · Maxpris: <b>' + kr(C.num(state.params.maxpris)) + '</b></span></div>';
    if (!r.rows.length) {
      return html + '<div class="empty">Inga lägenheter ännu.<br>Lägg till din första kandidat-etta för att se kalkyl, köpa-vs-hyra och poäng.</div>';
    }
    html += '<div class="cards">' + sortByRank(active).map(aptCard).join('') + '</div>';
    if (archived.length) {
      html += '<h2 class="section-title" style="margin-top:24px">Arkiv / historik (' + archived.length + ')</h2>' +
        '<div class="cards">' + sortByRank(archived).map(aptCard).join('') + '</div>';
    }
    return html;
  }
  function sortByRank(rows) {
    return rows.slice().sort(function (a, b) {
      return (a.rank || 999) - (b.rank || 999);
    });
  }
  function aptCard(r) {
    var c = r.c, k = r.k;
    var meta = [c.rum ? c.rum + ' rok' : '', c.kvm ? c.kvm + ' kvm' : '', c.avgift ? kr(C.num(c.avgift)) + '/mån' : ''].filter(Boolean).join(' · ');
    var body;
    if (!k) {
      body = '<p class="hint">Ange utgångspris eller slutpris för att räkna.</p>';
    } else {
      body = '<div class="kvs">' +
        kv(C.num(c.slutpris) !== null ? 'Slutpris' : 'Utgångspris', kr(k.pris)) +
        kv('Lån <span class="pill ' + (k.overTak ? 'warn' : 'muted') + '">' + pct(k.ltv, 0) + '</span>', kr(k.lan)) +
        kv('Betalar/mån', kr(k.kassaflode)) +
        kv('Verklig kostnad/mån', kr(k.verklig)) +
        kv('Köpa − hyra/mån', signed(k.diffHyra)) +
        kv('Poäng', scoreBar(r.total)) +
        '</div>' +
        (k.overTak ? '<p style="margin:8px 0 0"><span class="pill warn">⚠ Över bolånetaket ' + pct(C.num(state.params.bolanetak), 0) + '</span></p>' : '');
    }
    return '<article class="apt' + (c.arkiv ? ' archived' : '') + '" data-act="edit-apt" data-id="' + c.id + '">' +
      '<div class="rank' + (r.rank ? '' : ' none') + '" title="Rang">' + (r.rank || '–') + '</div>' +
      '<h3>' + esc(c.adress || 'Namnlös lägenhet') + '</h3><div class="meta">' + esc(meta || '–') + '</div>' + body + '</article>';
  }
  function kv(label, value) {
    return '<div class="kv"><span>' + label + '</span><b>' + value + '</b></div>';
  }
  function scoreBar(v) {
    if (v === null || v === undefined) return '–';
    return '<span class="bar"><span class="track"><span class="fill" style="width:' + ((v - 1) / 4 * 100).toFixed(0) + '%"></span></span>' + sc(v) + '</span>';
  }

  var APT_FIELDS = [
    { title: 'Objekt' },
    { k: 'adress', l: 'Adress / objekt', kind: 'text', full: true },
    { k: 'utgangspris', l: 'Utgångspris (kr)', kind: 'money' },
    { k: 'slutpris', l: 'Slutpris om känt (kr)', kind: 'money' },
    { k: 'avgift', l: 'Avgift/mån (kr)', kind: 'money' },
    { k: 'rum', l: 'Antal rum', kind: 'num' },
    { k: 'kvm', l: 'Antal kvm', kind: 'num' },
    { k: 'lank', l: 'Länk till annons', kind: 'text' },
    { title: 'Kalkyl' },
    { k: 'ranta', l: 'Ränta (%) – tomt = standard', kind: 'pct' },
    { k: 'underhall', l: 'Underhåll/drift per mån (kr)', kind: 'money' },
    { k: 'hyra', l: 'Hyra för motsvarande etta/mån (kr)', kind: 'money' },
    { title: 'Mjuka kriterier (tomma räknas inte)' },
    { k: 'vatten', l: 'Vattenutsikt', opts: ['Ja', 'Nej'] },
    { k: 'balkong', l: 'Balkong', opts: ['Inglasad', 'Ja', 'Nej'] },
    { k: 'pplats', l: 'P-plats', opts: ['Ja', 'Nej'] },
    { k: 'hiss', l: 'Hiss', opts: ['Ja', 'Nej'] },
    { k: 'trappor', l: 'Antal trappor', kind: 'num' },
    { k: 'branta', l: 'Branta backar', opts: ['Ja', 'Nej'] },
    { k: 'gron', l: 'Grönområde (min)', kind: 'num' },
    { k: 'matbutik', l: 'Matbutik (min)', kind: 'num' },
    { k: 'tbana', l: 'T-bana (min)', kind: 'num' },
    { k: 'vallentuna', l: 'Vallentuna (min)', kind: 'num' },
    { k: 'dramaten', l: 'Dramaten/City (min)', kind: 'num' },
    { k: 'eget1', l: 'eget1', kind: 'num', score: true },
    { k: 'eget2', l: 'eget2', kind: 'num', score: true },
    { k: 'anteckning', l: 'Anteckningar', kind: 'area', full: true }
  ];

  function openApt(id) {
    var c = id ? state.candidates.find(function (x) { return x.id === id; }) : { id: uid() };
    var isNew = !id;
    var body = '';
    APT_FIELDS.forEach(function (f) {
      if (f.title) { body += (body ? '</div>' : '') + '<h3 class="section-title">' + f.title + '</h3><div class="form">'; return; }
      var v = c[f.k];
      var label = f.l;
      if (f.score) label = esc(critLabel(C.CRITERIA.find(function (x) { return x.key === f.k; }))) + ' (1–5)';
      var input;
      if (f.opts) {
        input = '<select name="' + f.k + '"><option value="">–</option>' + f.opts.map(function (o) {
          return '<option' + (v === o ? ' selected' : '') + '>' + o + '</option>';
        }).join('') + '</select>';
      } else if (f.kind === 'area') {
        input = '<textarea name="' + f.k + '" rows="3">' + esc(v) + '</textarea>';
      } else {
        var ph = f.k === 'ranta' ? ' placeholder="' + toInput(state.params.ranta, 'pct') + '"' : '';
        var mm = f.score ? ' type="number" min="1" max="5" step="1"' : '';
        input = '<input name="' + f.k + '" data-kind="' + f.kind + '"' + ph + mm +
          (f.kind === 'text' ? '' : ' inputmode="decimal"') + ' value="' + esc(toInput(v, f.kind)) + '">';
      }
      body += '<label' + (f.full ? ' class="full"' : '') + '>' + label + input + '</label>';
    });
    body += '</div>';
    if (c.lank) body += '<p><a href="' + esc(c.lank) + '" target="_blank" rel="noopener">Öppna annonsen ↗</a></p>';

    var dlg = document.getElementById('dlg');
    dlg.innerHTML = '<form method="dialog" id="apt-form">' +
      '<div class="dlg-head"><h2>' + (isNew ? 'Ny lägenhet' : esc(c.adress || 'Lägenhet')) + '</h2>' +
      '<button type="button" class="btn small" data-close>✕</button></div>' +
      '<div class="dlg-body">' + body + '</div>' +
      '<div class="dlg-foot"><button class="btn primary" value="save">Spara</button>' +
      (isNew ? '' : '<button class="btn" value="archive">' + (c.arkiv ? 'Flytta till aktiva' : 'Flytta till arkiv') + '</button>' +
        '<button class="btn danger" value="delete">Ta bort</button>') +
      '<span class="spacer"></span><button type="button" class="btn" data-close>Avbryt</button></div></form>';
    dlg.onclose = function () {
      var action = dlg.returnValue;
      if (action === 'save' || action === 'archive') {
        var form = document.getElementById('apt-form');
        APT_FIELDS.forEach(function (f) {
          if (!f.k) return;
          var el = form.elements[f.k];
          c[f.k] = f.opts || f.kind === 'area' ? el.value : fromInput(el.value, f.kind);
        });
        if (action === 'archive') c.arkiv = !c.arkiv;
        if (isNew) state.candidates.push(c);
      } else if (action === 'delete') {
        if (!confirm('Ta bort ' + (c.adress || 'lägenheten') + '?')) return;
        state.candidates = state.candidates.filter(function (x) { return x.id !== c.id; });
      } else return;
      save();
      render();
    };
    dlg.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () { dlg.close('cancel'); });
    });
    dlg.returnValue = '';
    dlg.showModal();
  }

  /* ---------- Flik: Utvärdering ---------- */
  function renderEval() {
    var html = '<section class="card" style="margin-bottom:16px"><h2>Vikter</h2>' +
      '<p class="hint">0 = kriteriet räknas inte. Totalen är ett viktat medelvärde av poängen 1–5; tomma kriterier hoppas över.</p>' +
      '<div class="weights">' + C.CRITERIA.map(function (cr) {
        return '<label>' + esc(critLabel(cr)) + field('weights.' + cr.key, 'num', '', ' type="number" min="0" step="1"') + '</label>';
      }).join('') + '</div>' +
      '<div class="form" style="margin:12px 0 0"><label>Namn på eget kriterium 1' + field('params.eget1Namn', 'text') + '</label>' +
      '<label>Namn på eget kriterium 2' + field('params.eget2Namn', 'text') + '</label></div>' +
      '</section>' +
      '<div class="toolbar"><label><input type="checkbox" id="chk-archive"' + (showArchive ? ' checked' : '') + '> Visa arkiv</label></div>' +
      '<div id="eval-table"></div>';
    return html;
  }
  function renderEvalTable() {
    var r = C.evaluate(state);
    var rows = sortByRank(r.rows.filter(function (x) { return showArchive || !x.c.arkiv; }));
    var el = document.getElementById('eval-table');
    if (!rows.length) { el.innerHTML = '<div class="empty">Inga lägenheter att utvärdera ännu.</div>'; return; }
    var crit = C.CRITERIA.filter(function (cr) { return (C.num(state.weights[cr.key]) || 0) > 0; });
    var head = '<tr><th>Lägenhet</th><th>Rang</th><th>Total</th><th>Pris</th><th>Lån</th><th>Boendekostn./mån</th>' +
      crit.map(function (cr) { return '<th title="Vikt ' + state.weights[cr.key] + '">' + esc(critLabel(cr)) + ' ×' + state.weights[cr.key] + '</th>'; }).join('') + '</tr>';
    var body = rows.map(function (x) {
      return '<tr class="' + (x.c.arkiv ? 'archived' : '') + '"><td><a href="#" data-act="edit-apt" data-id="' + x.c.id + '">' + esc(x.c.adress || 'Namnlös') + '</a></td>' +
        '<td>' + (x.rank || '–') + '</td><td>' + scoreBar(x.total) + '</td>' +
        '<td>' + (x.k ? kr(x.k.pris) : '–') + '</td><td>' + (x.k ? kr(x.k.lan) : '–') + '</td><td>' + (x.k ? kr(x.k.boendekostnad) : '–') + '</td>' +
        crit.map(function (cr) {
          var v = x.scores ? x.scores[cr.key] : 0;
          return '<td><span class="score" style="background:' + heat(v) + '">' + sc(v) + '</span></td>';
        }).join('') + '</tr>';
    }).join('');
    el.innerHTML = '<div class="table-wrap"><table><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
  }
  function heat(v) {
    if (!v) return 'transparent';
    var a = ((v - 1) / 4 * 0.45 + 0.05).toFixed(2);
    return 'rgba(46,125,79,' + a + ')';
  }

  /* ---------- Flik: Fakturor ---------- */
  var INV_COLS = [
    { k: 'nr', l: 'Fakturanr', kind: 'text' },
    { k: 'datum', l: 'Fakturadatum', kind: 'date' },
    { k: 'forfallo', l: 'Förfallodatum', kind: 'date' },
    { k: 'leverantor', l: 'Leverantör', kind: 'text', wide: true },
    { k: 'projekt', l: 'Projekt / typ', kind: 'text', wide: true },
    { k: 'exkl', l: 'Exkl. moms', kind: 'money' },
    { k: 'moms', l: 'Moms (25 %)', kind: 'money' },
    { k: 'att', l: 'Att betala', kind: 'money' },
    { k: 'status', l: 'Status', opts: ['Obetald', 'Betald', 'Bestriden'] },
    { k: 'kommentar', l: 'Kommentar', kind: 'text', wide: true }
  ];
  function renderInv() {
    return '<div class="toolbar"><button class="btn primary" data-act="add-inv">+ Ny faktura</button>' +
      '<button class="btn" data-act="add-cat">+ Ny kostnadskategori</button></div>' +
      '<p class="hint">Underleverantörer (Hard Workers, Beijer, HLL, Sortera) ingår som rader i Thessén &amp; Ek-fakturorna. Moms räknas fram automatiskt när du ändrar beloppet exkl. moms.</p>' +
      '<div id="inv-tables"></div>';
  }
  function renderInvTables() {
    var t = C.invoices(state);
    var today = new Date().toISOString().slice(0, 10);
    var head = '<tr>' + INV_COLS.map(function (c) { return '<th>' + c.l + '</th>'; }).join('') + '<th></th></tr>';
    var body = state.invoices.map(function (f, i) {
      var overdue = f.status !== 'Betald' && f.forfallo && f.forfallo < today;
      return '<tr>' + INV_COLS.map(function (c) {
        var v = f[c.k];
        var inp;
        if (c.opts) {
          inp = '<select data-inv="' + i + '" data-k="' + c.k + '">' + c.opts.map(function (o) {
            return '<option' + (v === o ? ' selected' : '') + '>' + o + '</option>';
          }).join('') + '</select>';
          if (overdue) inp += ' <span class="pill warn">Förfallen</span>';
        } else {
          inp = '<input data-inv="' + i + '" data-k="' + c.k + '" data-kind="' + (c.kind === 'date' ? 'text' : c.kind) + '"' +
            (c.kind === 'date' ? ' type="date"' : '') + (c.wide ? ' class="wide"' : '') + ' value="' + esc(v) + '">';
        }
        return '<td>' + inp + '</td>';
      }).join('') + '<td><button class="btn small danger" data-act="del-inv" data-i="' + i + '">✕</button></td></tr>';
    }).join('');
    var foot = '<tr><td>Totalt</td><td></td><td></td><td></td><td></td><td>' + kr2(t.totals.exkl) + '</td><td>' + kr2(t.totals.moms) +
      '</td><td>' + kr(t.totals.att) + '</td><td colspan="3">Obetalt: ' + kr(t.totals.obetalt) + '</td></tr>';

    var chead = '<tr><th>Kategori (exkl. moms)</th>' + state.invoices.map(function (f) { return '<th>' + esc(f.nr) + '</th>'; }).join('') +
      '<th>Totalt</th><th>Andel</th><th></th></tr>';
    var cbody = t.cats.map(function (cat, ci) {
      return '<tr><td>' + esc(cat.name) + '</td>' + state.invoices.map(function (f, i) {
        return '<td><input data-split="' + i + '" data-cat="' + ci + '" inputmode="decimal" value="' + esc((f.split || {})[cat.name] || '') + '"></td>';
      }).join('') + '<td>' + kr2(cat.total) + '</td><td>' + scoreShare(cat.share) + '</td>' +
      '<td><button class="btn small danger" data-act="del-cat" data-i="' + ci + '">✕</button></td></tr>';
    }).join('');
    var cfoot = '<tr><td>Totalt</td>' + state.invoices.map(function (f, i) {
      var diff = Math.abs(t.splitSums[i] - (C.num(f.exkl) || 0)) > 0.5;
      return '<td' + (diff ? ' title="Stämmer inte med fakturans belopp exkl. moms (' + kr2(C.num(f.exkl)) + ')"' : '') + '>' +
        kr2(t.splitSums[i]) + (diff ? ' <span class="pill warn">≠ faktura</span>' : '') + '</td>';
    }).join('') + '<td>' + kr2(t.catTotal) + '</td><td>' + (t.catTotal ? '100 %' : '–') + '</td><td></td></tr>';

    document.getElementById('inv-tables').innerHTML =
      '<h2 class="section-title">Fakturalogg</h2>' +
      '<div class="table-wrap" style="margin-bottom:24px"><table><thead>' + head + '</thead><tbody>' + body + '</tbody><tfoot>' + foot + '</tfoot></table></div>' +
      '<h2 class="section-title">Kostnadsuppdelning</h2>' +
      '<div class="table-wrap"><table><thead>' + chead + '</thead><tbody>' + cbody + '</tbody><tfoot>' + cfoot + '</tfoot></table></div>';
  }
  function scoreShare(v) {
    if (v === null) return '–';
    return '<span class="bar"><span class="track"><span class="fill" style="width:' + (v * 100).toFixed(0) + '%"></span></span>' + pct(v) + '</span>';
  }

  /* ---------- Flik: Metod ---------- */
  function renderMethod() {
    return '<div class="card method">' +
      '<h2>Betygsskala för närhet (gångtid)</h2>' +
      '<table><tr><th>Betyg</th><th>Gångtid</th></tr>' +
      '<tr><td>5</td><td>Mindre än 5 min</td></tr><tr><td>4</td><td>5–15 min</td></tr><tr><td>3</td><td>16–30 min</td></tr>' +
      '<tr><td>2</td><td>31–60 min</td></tr><tr><td>1</td><td>Mer än 60 min</td></tr></table>' +
      '<h2 style="margin-top:20px">Så räknas poäng (1–5)</h2><ul>' +
      '<li><b>Pris, avgift, lånebelopp, handpenning:</b> normaliseras mot övriga inlagda objekt (min–max, inklusive arkivet). Lägst får 5, högst får 1. Är alla lika får de 3.</li>' +
      '<li><b>Kvm:</b> samma min–max, men störst får 5.</li>' +
      '<li><b>Mot maxpris:</b> pris/maxpris &gt; 110 % = 1, 90–110 % = 3, 80–90 % = 4, under 80 % = 5.</li>' +
      '<li><b>Rum:</b> 4+ = 5, 3 = 3, annars 1.</li>' +
      '<li><b>Vattenutsikt, P-plats, hiss:</b> Ja = 5, Nej = 1. <b>Branta backar:</b> Ja = 1, Nej = 5. <b>Balkong:</b> Inglasad = 5, Ja = 3, Nej = 1.</li>' +
      '<li><b>Trappor:</b> 0 = 5, 1 = 4, 2 = 3, 3 = 2, 4+ = 1. Räknas inte alls om huset har hiss.</li>' +
      '<li><b>Gångtider</b> (grönområde, matbutik, T-bana, Vallentuna, Dramaten/City): enligt skalan ovan.</li>' +
      '<li><b>Egna kriterier:</b> du sätter 1–5 direkt.</li>' +
      '<li><b>Total:</b> viktat medelvärde av poängen. Tomma kriterier räknas inte. Rang 1 = högst total.</li></ul>' +
      '<h2 style="margin-top:20px">Köpkalkyl</h2><ul>' +
      '<li>Lån = pris − kontantinsats. Belåningsgrad = lån / pris; varning över bolånetaket.</li>' +
      '<li>Amortering: 2 % över 70 % belåning, 1 % över 50 %, plus 1 % om lånet är över 4,5 × bruttoinkomsten (om skärpt krav är påslaget).</li>' +
      '<li>Ränteavdrag: 30 % upp till taket, 21 % därutöver.</li>' +
      '<li>Betalar/mån = ränta + amortering + avgift + underhåll. Verklig kostnad = ränta − ränteavdrag + avgift + underhåll.</li>' +
      '<li>Köpa, full kostnad = verklig kostnad + alternativkostnad för kapitalet − förväntad värdeökning. Jämförs mot hyran.</li></ul>' +
      '<h2 style="margin-top:20px">Anmärkningar &amp; begränsningar</h2><ul>' +
      '<li>Pris, handpenning och lånebelopp mäter i praktiken samma sak. Handpenningen är densamma för alla lägenheter och ger därför alltid 3 poäng; lånebeloppet följer priset exakt. Med vikt på alla tre dubbelräknas priset – sätt lån och handpenning till 0 om du inte vill det.</li>' +
      '<li>Min–max-normaliseringen är relativ: ett objekts poäng beror på vilka andra objekt som finns i listan.</li>' +
      '<li>Vallentuna, vatten och Dramaten drar geografiskt åt olika håll. Den verkliga avvägningen görs i vikterna.</li>' +
      '<li>Skillnader mot Excel-filen: kontantinsatsen hämtas från kapitalberäkningen (Excel hade ett separat, hårdkodat belopp på fliken Utvärdering), alternativkostnaden räknas bara på kapital som faktiskt binds i lägenheten, och antalet lägenheter är inte begränsat till 5 + 10.</li>' +
      '</ul><p class="hint">Data sparas lokalt i den här webbläsaren. Använd Exportera för säkerhetskopia eller för att flytta till en annan enhet.</p></div>';
  }

  /* ---------- Rendering & händelser ---------- */
  function render() {
    var v = document.getElementById('view');
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    if (tab === 'sim') { v.innerHTML = renderSim(); updateSimOutputs(); }
    else if (tab === 'apts') v.innerHTML = renderApts();
    else if (tab === 'eval') { v.innerHTML = renderEval(); renderEvalTable(); }
    else if (tab === 'inv') { v.innerHTML = renderInv(); renderInvTables(); }
    else v.innerHTML = renderMethod();
  }

  document.getElementById('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-tab]');
    if (!b) return;
    tab = b.getAttribute('data-tab');
    try { sessionStorage.setItem('ettor-tab', tab); } catch (err) { /* ignoreras */ }
    render();
  });

  var view = document.getElementById('view');
  view.addEventListener('input', function (e) {
    var t = e.target;
    if (t.hasAttribute('data-bind')) {
      setPath(t.getAttribute('data-bind'), fromInput(t.value, t.getAttribute('data-kind')));
      save();
      if (tab === 'sim') updateSimOutputs();
      if (tab === 'eval') renderEvalTable();
    }
  });
  view.addEventListener('change', function (e) {
    var t = e.target;
    if (t.hasAttribute('data-check')) {
      setPath(t.getAttribute('data-check'), t.checked);
      save();
      render();
    } else if (t.id === 'chk-archive') {
      showArchive = t.checked;
      renderEvalTable();
    } else if (t.hasAttribute('data-bind') && tab === 'eval' && /Namn$/.test(t.getAttribute('data-bind'))) {
      render();
    } else if (t.hasAttribute('data-inv')) {
      var f = state.invoices[+t.getAttribute('data-inv')], k = t.getAttribute('data-k');
      var kind = t.getAttribute('data-kind');
      f[k] = kind === 'money' ? fromInput(t.value, 'money') : t.value;
      if (k === 'exkl' && f.exkl !== '') {
        f.moms = Math.round(f.exkl * 25) / 100;
        f.att = Math.round(f.exkl + f.moms);
      }
      save();
      renderInvTables();
    } else if (t.hasAttribute('data-split')) {
      var inv = state.invoices[+t.getAttribute('data-split')];
      inv.split = inv.split || {};
      inv.split[state.categories[+t.getAttribute('data-cat')]] = fromInput(t.value, 'money');
      save();
      renderInvTables();
    }
  });
  view.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (act === 'add-apt') openApt(null);
    else if (act === 'edit-apt') { e.preventDefault(); openApt(t.getAttribute('data-id')); }
    else if (act === 'add-inv') {
      state.invoices.push({ id: uid(), nr: '', datum: new Date().toISOString().slice(0, 10), forfallo: '', leverantor: '',
        projekt: 'Karlavägen 71', exkl: '', moms: '', att: '', status: 'Obetald', kommentar: '', split: {} });
      save(); renderInvTables();
    } else if (act === 'del-inv') {
      var f = state.invoices[+t.getAttribute('data-i')];
      if (confirm('Ta bort faktura ' + (f.nr || '') + '?')) {
        state.invoices.splice(+t.getAttribute('data-i'), 1);
        save(); renderInvTables();
      }
    } else if (act === 'add-cat') {
      var name = prompt('Namn på ny kostnadskategori');
      if (name && state.categories.indexOf(name) < 0) { state.categories.push(name); save(); renderInvTables(); }
    } else if (act === 'del-cat') {
      var ci = +t.getAttribute('data-i'), cat = state.categories[ci];
      if (confirm('Ta bort kategorin ' + cat + '? Belopp i den försvinner.')) {
        state.categories.splice(ci, 1);
        state.invoices.forEach(function (x) { if (x.split) delete x.split[cat]; });
        save(); renderInvTables();
      }
    }
  });

  /* ---------- Export / import ---------- */
  document.getElementById('btn-export').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ettor-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  document.getElementById('btn-import').addEventListener('click', function () {
    document.getElementById('file-import').click();
  });
  document.getElementById('file-import').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    file.text().then(function (txt) {
      var s = JSON.parse(txt);
      if (!s.params || !s.candidates) throw new Error('fel format');
      if (!confirm('Ersätta nuvarande data med innehållet i ' + file.name + '?')) return;
      state = normalize(s);
      save();
      render();
    }).catch(function (err) { alert('Kunde inte läsa filen: ' + err.message); });
    e.target.value = '';
  });

  try { tab = sessionStorage.getItem('ettor-tab') || tab; } catch (err) { /* ignoreras */ }
  render();
})();
