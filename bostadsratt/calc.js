/* Beräkningslogik – speglar formlerna i "Utvärdering av bostadsrätter – Ettor.xlsx".
   Ren logik utan DOM, så att den kan testas med Node (se calc.test.js). */
(function (root) {
  'use strict';

  var CRITERIA = [
    { key: 'pris',       label: 'Pris',            short: 'Pris' },
    { key: 'avgift',     label: 'Avgift',          short: 'Avgift' },
    { key: 'lan',        label: 'Lånebelopp',      short: 'Lån' },
    { key: 'handpenning',label: 'Handpenning',     short: 'Handp.' },
    { key: 'maxpris',    label: 'Mot maxpris',     short: 'Maxpris' },
    { key: 'rum',        label: 'Antal rum',       short: 'Rum' },
    { key: 'kvm',        label: 'Antal kvm',       short: 'Kvm' },
    { key: 'vatten',     label: 'Vattenutsikt',    short: 'Vatten' },
    { key: 'balkong',    label: 'Balkong',         short: 'Balkong' },
    { key: 'pplats',     label: 'P-plats',         short: 'P-plats' },
    { key: 'gron',       label: 'Grönområde',      short: 'Grönt' },
    { key: 'hiss',       label: 'Hiss',            short: 'Hiss' },
    { key: 'trappor',    label: 'Antal trappor',   short: 'Trappor' },
    { key: 'matbutik',   label: 'Matbutik',        short: 'Mat' },
    { key: 'tbana',      label: 'T-bana',          short: 'T-bana' },
    { key: 'branta',     label: 'Branta backar',   short: 'Backar' },
    { key: 'vallentuna', label: 'Vallentuna',      short: 'Vallent.' },
    { key: 'dramaten',   label: 'Dramaten/City',   short: 'City' },
    { key: 'eget1',      label: 'Eget kriterium 1',short: 'Eget 1' },
    { key: 'eget2',      label: 'Eget kriterium 2',short: 'Eget 2' }
  ];

  // Vikterna exakt som rad 5 i fliken Utvärdering.
  var DEFAULT_WEIGHTS = {
    pris: 4, avgift: 2, lan: 1, handpenning: 1, maxpris: 0, rum: 2, kvm: 2,
    vatten: 4, balkong: 3, pplats: 2, gron: 3, hiss: 3, trappor: 1, matbutik: 2,
    tbana: 1, branta: 3, vallentuna: 5, dramaten: 5, eget1: 1, eget2: 1
  };

  // Släckt kriterium eller vikt 0 = räknas inte i totalen.
  function weightOf(state, key) {
    var c = state.criteria && state.criteria[key];
    if (c && c.av) return 0;
    return num(state.weights[key]) || 0;
  }

  function num(v) {
    if (v === '' || v === null || v === undefined) return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  function lower(v) { return v == null ? '' : String(v).trim().toLowerCase(); }

  /* ---------- Bakgrund: Rådmansgatan såld → Karlavägen köpt ---------- */
  function background(p) {
    var salj = num(p.saljpris) || 0;
    var inkop = num(p.inkopspris) || 0;
    var forb = num(p.forbattringar) || 0;
    var maklarKr = salj * (num(p.maklarPct) || 0);
    var reavinst = Math.max(0, salj - inkop - forb - maklarKr);
    var ersattning = num(p.karlavagenPris) || 0;
    var tak = num(p.takbelopp) || 0;
    var uppskov = (salj === 0 || reavinst < 50000) ? 0
      : Math.min(tak, reavinst, reavinst * ersattning / salj);
    var vinstskatt = Math.max(0, reavinst - uppskov) * 0.22;
    var nettolikvid = salj - (num(p.restlan) || 0) - maklarKr - vinstskatt;
    var kontantKarla = ersattning - (num(p.karlavagenLan) || 0);
    return {
      maklarKr: maklarKr,
      reavinst: reavinst,
      uppskov: uppskov,
      vinstskatt: vinstskatt,
      nettolikvid: nettolikvid,
      kontantKarlavagen: kontantKarla,
      kvarvarande: nettolikvid - kontantKarla
    };
  }

  function handpenning(p, bg) {
    if (p.handpenningAuto !== false) return bg.kvarvarande;
    return num(p.handpenningManuell) || 0;
  }

  function minutesScore(m) {
    if (m === null) return 0;
    if (m < 5) return 5;
    if (m <= 15) return 4;
    if (m <= 30) return 3;
    if (m <= 60) return 2;
    return 1;
  }

  /* ---------- Köpkalkyl per lägenhet (Simulering rad 36–57) ---------- */
  function purchase(c, p, kontant) {
    var pris = num(c.slutpris) !== null ? num(c.slutpris) : num(c.utgangspris);
    if (pris === null) return null;
    var avgift = num(c.avgift) || 0;
    var ranta = num(c.ranta) !== null ? num(c.ranta) : (num(p.ranta) || 0);
    var underhall = num(c.underhall) || 0;
    var lan = Math.max(0, pris - kontant);
    var ltv = pris === 0 ? null : lan / pris;
    var overskott = Math.max(0, kontant - pris);
    var tak = num(p.bolanetak);
    var inkomst = num(p.inkomst) || 0;
    var amortPct = (ltv > 0.7 ? 0.02 : ltv > 0.5 ? 0.01 : 0) +
      (p.skarptAmortering !== false && inkomst > 0 && lan > 4.5 * inkomst ? 0.01 : 0);
    var rantaAr = lan * ranta;
    var avdragTak = num(p.avdragTak) || 0;
    var rantaMan = rantaAr / 12;
    var amortMan = lan * amortPct / 12;
    var avdragMan = (Math.min(rantaAr, avdragTak) * 0.3 + Math.max(0, rantaAr - avdragTak) * 0.21) / 12;
    var kassaflode = rantaMan + amortMan + avgift + underhall;
    var verklig = rantaMan - avdragMan + avgift + underhall;
    // Excel räknar alternativkostnad på hela kontantinsatsen även när den överstiger priset.
    // Här räknas bara det kapital som faktiskt binds i lägenheten.
    var bundet = Math.min(kontant, pris);
    var altkost = bundet * (num(p.avkastning) || 0) / 12;
    var vardeokning = pris * (num(p.vardeokning) || 0) / 12;
    var full = verklig + altkost - vardeokning;
    var hyra = num(c.hyra);
    return {
      pris: pris,
      kontant: kontant,
      lan: lan,
      ltv: ltv,
      overskott: overskott,
      overTak: tak !== null && ltv !== null && ltv > tak,
      ranta: ranta,
      amortPct: amortPct,
      rantaMan: rantaMan,
      amortMan: amortMan,
      avdragMan: avdragMan,
      kassaflode: kassaflode,
      boendekostnad: avgift + rantaMan + amortMan, // Utvärdering kol J
      verklig: verklig,
      altkost: altkost,
      vardeokning: vardeokning,
      full: full,
      hyra: hyra,
      diffHyra: hyra === null ? null : full - hyra
    };
  }

  /* ---------- Poäng 1–5 (Utvärdering kol Z–AU) ---------- */
  function rangeScore(v, all, higherIsBetter) {
    if (v === null) return 0;
    var vals = all.filter(function (x) { return x !== null; });
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    if (mx === mn) return 3;
    var t = (v - mn) / (mx - mn);
    return higherIsBetter ? 1 + 4 * t : 5 - 4 * t;
  }

  function evaluate(state) {
    var p = state.params;
    var bg = background(p);
    var kontant = handpenning(p, bg);
    var rows = state.candidates.map(function (c) {
      return { c: c, k: purchase(c, p, kontant) };
    });
    function col(fn) { return rows.map(function (r) { return r.k ? fn(r) : null; }); }
    var prisAll = col(function (r) { return r.k.pris; });
    var avgAll = col(function (r) { return num(r.c.avgift); });
    var lanAll = col(function (r) { return r.k.lan; });
    var hpAll = col(function (r) { return r.k.kontant; });
    var kvmAll = col(function (r) { return num(r.c.kvm); });
    var maxpris = num(p.maxpris) || 0;

    rows.forEach(function (r, i) {
      var c = r.c, s = {};
      if (!r.k) { r.scores = null; r.total = null; return; }
      s.pris = rangeScore(prisAll[i], prisAll, false);
      s.avgift = rangeScore(avgAll[i], avgAll, false);
      s.lan = rangeScore(lanAll[i], lanAll, false);
      s.handpenning = rangeScore(hpAll[i], hpAll, false);
      var q = maxpris ? r.k.pris / maxpris : null;
      s.maxpris = q === null ? 0 : q > 1.1 ? 1 : q >= 0.9 ? 3 : q >= 0.8 ? 4 : 5;
      var rum = num(c.rum);
      s.rum = rum === null ? 0 : rum >= 4 ? 5 : rum === 3 ? 3 : 1;
      s.kvm = rangeScore(kvmAll[i], kvmAll, true);
      s.vatten = c.vatten ? (lower(c.vatten) === 'ja' ? 5 : 1) : 0;
      var b = lower(c.balkong);
      s.balkong = b === 'inglasad' ? 5 : b === 'ja' ? 3 : b === 'nej' ? 1 : 0;
      s.pplats = c.pplats ? (lower(c.pplats) === 'ja' ? 5 : 1) : 0;
      s.gron = minutesScore(num(c.gron));
      s.hiss = c.hiss ? (lower(c.hiss) === 'ja' ? 5 : 1) : 0;
      var tr = num(c.trappor);
      s.trappor = (tr === null || lower(c.hiss) === 'ja') ? 0 : Math.max(1, 5 - tr);
      s.matbutik = minutesScore(num(c.matbutik));
      s.tbana = minutesScore(num(c.tbana));
      s.branta = c.branta ? (lower(c.branta) === 'ja' ? 1 : 5) : 0;
      s.vallentuna = minutesScore(num(c.vallentuna));
      s.dramaten = minutesScore(num(c.dramaten));
      s.eget1 = num(c.eget1) || 0;
      s.eget2 = num(c.eget2) || 0;
      var sum = 0, den = 0;
      CRITERIA.forEach(function (cr) {
        var w = weightOf(state, cr.key);
        sum += w * s[cr.key];
        if (s[cr.key] > 0) den += w;
      });
      r.scores = s;
      r.total = den > 0 ? sum / den : null;
    });
    rows.forEach(function (r) {
      if (r.total === null) { r.rank = null; return; }
      r.rank = rows.filter(function (o) { return o.total !== null && o.total > r.total; }).length + 1;
    });
    return { bg: bg, kontant: kontant, rows: rows };
  }

  /* ---------- Fakturor ---------- */
  function invoices(state) {
    var inv = state.invoices;
    var tot = { exkl: 0, moms: 0, att: 0, obetalt: 0 };
    inv.forEach(function (f) {
      tot.exkl += num(f.exkl) || 0;
      tot.moms += num(f.moms) || 0;
      tot.att += num(f.att) || 0;
      if (lower(f.status) !== 'betald') tot.obetalt += num(f.att) || 0;
    });
    var cats = state.categories.map(function (cat) {
      var per = inv.map(function (f) { return num((f.split || {})[cat]) || 0; });
      var total = per.reduce(function (a, b) { return a + b; }, 0);
      return { name: cat, per: per, total: total };
    });
    var catTotal = cats.reduce(function (a, c) { return a + c.total; }, 0);
    cats.forEach(function (c) { c.share = catTotal ? c.total / catTotal : null; });
    var splitSums = inv.map(function (f, i) {
      return cats.reduce(function (a, c) { return a + c.per[i]; }, 0);
    });
    return { totals: tot, cats: cats, catTotal: catTotal, splitSums: splitSums };
  }

  // Per kriterium: eget namn (tomt = standardnamnet) och om det är släckt.
  function defaultCriteria() {
    var o = {};
    CRITERIA.forEach(function (cr) { o[cr.key] = { namn: '', av: false }; });
    return o;
  }

  /* ---------- Startdata från Excel-filen ---------- */
  function defaultState() {
    return {
      version: 1,
      params: {
        saljpris: 24000000, inkopspris: 0, forbattringar: 0, maklarPct: 0.015, restlan: 0,
        karlavagenPris: 15600000, takbelopp: 3000000, karlavagenLan: 0,
        avdragTak: 100000, inkomst: 0, vardeokning: 0.02, avkastning: 0.04,
        maxpris: 7000000, ranta: 0.025, bolanetak: 0.85, skarptAmortering: true,
        handpenningAuto: true, handpenningManuell: 6835600
      },
      weights: Object.assign({}, DEFAULT_WEIGHTS),
      criteria: defaultCriteria(),
      candidates: [],
      categories: [
        'Arbete & arbetsledning', 'Material (Beijer Byggmaterial)', 'Rivning (Hard Workers)',
        'Maskinhyra / luftrenare (HLL)', 'Avfall & sophantering (Sortera)', 'Övrigt (servicebil, P-avgift)'
      ],
      invoices: [
        {
          id: 'f132387', nr: '132387', datum: '2026-09-25', forfallo: '2026-10-05',
          leverantor: 'Thessén & Ek Byggentreprenad AB', projekt: 'Karlavägen 71 – rev 1 (byggentreprenad)',
          exkl: 44058.91, moms: 11014.73, att: 55074, status: 'Obetald', kommentar: '',
          split: {
            'Arbete & arbetsledning': 10200, 'Material (Beijer Byggmaterial)': 5947.2,
            'Rivning (Hard Workers)': 22960, 'Maskinhyra / luftrenare (HLL)': 0,
            'Avfall & sophantering (Sortera)': 4551.71, 'Övrigt (servicebil, P-avgift)': 400
          }
        },
        {
          id: 'f132388', nr: '132388', datum: '2026-09-25', forfallo: '2026-10-05',
          leverantor: 'Thessén & Ek Byggentreprenad AB', projekt: 'Karlavägen 71 – ÄTA (tillkommande arbeten)',
          exkl: 67332.33, moms: 16833.08, att: 84165, status: 'Obetald', kommentar: '',
          split: {
            'Arbete & arbetsledning': 27360, 'Material (Beijer Byggmaterial)': 29598.11,
            'Rivning (Hard Workers)': 0, 'Maskinhyra / luftrenare (HLL)': 7674.22,
            'Avfall & sophantering (Sortera)': 0, 'Övrigt (servicebil, P-avgift)': 2700
          }
        }
      ]
    };
  }

  var api = {
    CRITERIA: CRITERIA, DEFAULT_WEIGHTS: DEFAULT_WEIGHTS, num: num,
    weightOf: weightOf, defaultCriteria: defaultCriteria,
    background: background, purchase: purchase, evaluate: evaluate,
    invoices: invoices, minutesScore: minutesScore, defaultState: defaultState
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(this);
