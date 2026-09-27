// Jämför calc.js mot värden som LibreOffice räknat fram ur originalets Excel-formler.
// Kör: node bostadsratt/test/calc.test.js
const assert = require('assert');
const path = require('path');
const Calc = require('../calc.js');
const fx = require(path.join(__dirname, 'fixture.json'));

function close(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} ≠ ${expected}`);
}

const state = Calc.defaultState();
state.candidates = fx.candidates;
const res = Calc.evaluate(state);

for (const [k, v] of Object.entries(fx.background)) close(res.bg[k], v, `bakgrund.${k}`);
close(res.kontant, fx.kontant, 'kontantinsats');

fx.expected.forEach((e, i) => {
  const row = res.rows[i];
  const name = fx.candidates[i].adress;
  for (const [k, v] of Object.entries(e)) {
    if (k === 'total') close(row.total, v, `${name} total`);
    else if (k === 'rank') assert.strictEqual(row.rank, v, `${name} rang`);
    else if (v === null) assert.strictEqual(row.k[k], null, `${name} ${k}`);
    else close(row.k[k], v, `${name} ${k}`);
  }
});

// Släckt kriterium ska ge samma resultat som vikt 0, och vikten ska ligga kvar.
const off = JSON.parse(JSON.stringify(state));
off.criteria.vallentuna.av = true;
const zero = JSON.parse(JSON.stringify(state));
zero.weights.vallentuna = 0;
const rOff = Calc.evaluate(off), rZero = Calc.evaluate(zero);
rOff.rows.forEach((r, i) => close(r.total, rZero.rows[i].total, `släckt = vikt 0 (${i})`));
assert.strictEqual(off.weights.vallentuna, 5, 'vikten ligger kvar när kriteriet släcks');
assert.ok(Math.abs(rOff.rows[0].total - res.rows[0].total) > 1e-6, 'släckning påverkar totalen');

// Avvikelse från Excel (medveten): alternativkostnad bara på kapital som binds i lägenheten.
const cheap = Calc.purchase({ utgangspris: 2000000 }, state.params, 3499200);
close(cheap.altkost, 2000000 * 0.04 / 12, 'altkost begränsas till priset');
close(cheap.overskott, 1499200, 'kontantöverskott');

// Fakturor: kostnadsuppdelningen ska stämma mot fakturornas belopp exkl. moms.
const inv = Calc.invoices(state);
close(inv.totals.att, 139239, 'fakturor att betala');
close(inv.catTotal, 111391.24, 'kostnadsuppdelning totalt');
state.invoices.forEach((f, i) => close(inv.splitSums[i], f.exkl, `uppdelning ${f.nr}`));

console.log('Alla tester OK');
