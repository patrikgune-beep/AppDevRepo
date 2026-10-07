'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { open } = require('../src/node-db');
const { saveExtraction, reconcile } = require('../src/store');
const { overview, compareUnitPrices } = require('../src/analytics');
const { runReadOnlySql, ask } = require('../src/ask');
const { extractSubmission } = require('../src/extract');
const { loadFixture } = require('../src/demo');
const fixture = require('../fixtures/karlavagen71.json');

function tmpDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fa-'));
  const file = path.join(dir, 'test.db');
  return { db: open(file), file };
}
const sumLines = (inv) => inv.lines.reduce((s, l) => s + (l.amount_excl_vat || 0), 0);

test('fixture: varje fakturas rader summerar till fakturans belopp', () => {
  for (const s of fixture.submissions) {
    for (const inv of s.extraction.invoices) {
      assert.ok(Math.abs(sumLines(inv) - inv.amount_excl_vat) < 0.01, `${inv.supplier_name} ${inv.invoice_number}`);
    }
  }
});

test('avstämning: total kostnad = summan av huvudfakturorna, påslag 12 % hittas, Beijer flaggas', () => {
  const { db } = tmpDb();
  const pid = loadFixture(db, fixture);
  const total = db.prepare('SELECT SUM(effective_amount) t FROM cost_lines WHERE project_id = ?').get(pid).t;
  assert.ok(Math.abs(total - (44058.91 + 55988.80 + 167883.20)) < 0.5, `total ${total}`);

  const inv = (no) => db.prepare('SELECT * FROM invoices WHERE invoice_number = ?').get(no);
  assert.equal(inv('33869').markup_status, 'ok');
  assert.equal(inv('33869').billed_ratio, 1.12);
  assert.equal(inv('260980851828').markup_status, 'avvikelse');

  // huvudfakturans klumprader ersätts av bilagornas detaljrader
  const lump = db.prepare("SELECT counted FROM line_items WHERE description LIKE 'HARD WORKERS%33869'").get();
  assert.equal(lump.counted, 0);

  const beijer = db.prepare("SELECT * FROM line_items WHERE article_no = '8210045095'").get();
  assert.equal(beijer.markup_assumed, 1);
  assert.equal(beijer.effective_unit_price, Math.round(27.51 * 1.12 * 100) / 100);

  const warn = db.prepare("SELECT message FROM findings WHERE severity = 'varning'").all();
  assert.ok(warn.some((w) => /Beijer/.test(w.message)));
});

test('analys: rivning 369 h à 481,60 kr för beställaren (430 kr + 12 %)', () => {
  const { db } = tmpDb();
  loadFixture(db, fixture);
  const r = compareUnitPrices(db, { dimension: 'trade', value: 'rivning', unit: 'h' });
  assert.equal(r.overall.quantity, 369); // 19 + 86 + 160 + 104 h
  assert.equal(r.overall.avg_price, 481.6);
  assert.equal(r.overall.avg_supplier_price, 430);
  // Hard Workers redovisas som egen leverantör, inte som Thessén & Ek
  const sup = Object.fromEntries(overview(db, {}).bySupplier.map((x) => [x.key, x.amount]));
  assert.equal(sup['Hard Workers of Sweden AB'], 235844); // 22 960 + 55 988,80 + 103 045,60 + 53 849,60
  assert.equal(sup['Thessén & Ek Byggentreprenad AB'], 21588); // bara arbetsledning och parkering
  const o = overview(db, { from: '2026-09', to: '2026-09' });
  assert.ok(o.byMonth.every((m) => m.key === '2026-09'));
});

test('dubblett: samma faktura uppladdad igen räknas inte två gånger', () => {
  const { db } = tmpDb();
  const pid = loadFixture(db, fixture);
  const before = db.prepare('SELECT SUM(effective_amount) t FROM cost_lines').get().t;
  const sid = Number(db.prepare("INSERT INTO submissions (project_id, label) VALUES (?, 'igen')").run(pid).lastInsertRowid);
  saveExtraction(db, sid, pid, fixture.submissions[0].extraction);
  reconcile(db, pid);
  const after = db.prepare('SELECT SUM(effective_amount) t FROM cost_lines').get().t;
  assert.ok(Math.abs(after - before) < 0.01);
  assert.ok(db.prepare("SELECT COUNT(*) c FROM findings WHERE message LIKE '%dubblett%'").get().c >= 1);
});

test('jämförelse mellan projekt: elektriker per timme, medel/min/max', () => {
  const { db } = tmpDb();
  const mk = (name, rates) => {
    const pid = Number(db.prepare('INSERT INTO projects (name) VALUES (?)').run(name).lastInsertRowid);
    const sid = Number(db.prepare('INSERT INTO submissions (project_id) VALUES (?)').run(pid).lastInsertRowid);
    const lines = rates.map(([h, p]) => ({ description: 'El', line_date: '2026-05-04', article_no: null, quantity: h,
      unit_raw: 'tim', unit: 'h', unit_price: p, amount_excl_vat: h * p, cost_category: 'arbete', trade: 'elektriker',
      resource_name: null, material_type: null, attachment_ref: null }));
    saveExtraction(db, sid, pid, { summary: '', supporting_documents: [], warnings: [], invoices: [{
      ref: 'F1', kind: 'huvudfaktura', parent_ref: null, source_file: 'x.pdf', pages: '1', supplier_name: 'El AB',
      supplier_orgnr: null, invoice_number: name, invoice_date: '2026-05-31', due_date: null, period_start: null,
      period_end: null, project_label: null, currency: 'SEK', amount_excl_vat: lines.reduce((s, l) => s + l.amount_excl_vat, 0),
      vat_amount: null, amount_incl_vat: null, reverse_charge_vat: false, lines }] });
    reconcile(db, pid);
    return pid;
  };
  const a = mk('A', [[10, 600], [30, 650]]);
  mk('B', [[20, 700]]);
  const r = compareUnitPrices(db, { dimension: 'trade', value: 'elektriker', unit: 'h' });
  const pa = r.perProject.find((p) => p.project_id === a);
  assert.equal(pa.avg_price, 637.5);
  assert.equal(pa.min_price, 600);
  assert.equal(pa.max_price, 650);
  assert.equal(r.overall.max_price, 700);
  assert.equal(r.perProject.length, 2);
});

test('SQL-verktyget släpper bara igenom läsfrågor', () => {
  const { db } = tmpDb();
  loadFixture(db, fixture);
  const ro = db;
  assert.ok(runReadOnlySql(ro, 'SELECT COUNT(*) AS n FROM cost_lines').rows[0].n > 0);
  for (const bad of ['DELETE FROM projects', 'SELECT 1; DROP TABLE projects', "ATTACH 'x' AS y",
    'WITH x AS (SELECT 1) DELETE FROM projects', 'PRAGMA table_info(projects)']) {
    assert.throws(() => runReadOnlySql(ro, bad), undefined, bad);
  }
  // query_only stoppar skrivningar även om en fråga skulle slinka igenom ordfiltret
  db.prepare('PRAGMA query_only = ON').run();
  assert.throws(() => db.prepare("UPDATE projects SET name = 'x'").run());
  db.prepare('PRAGMA query_only = OFF').run();
  assert.equal(db.prepare('SELECT COUNT(*) n FROM projects').get().n, 1);
});

test('ask: verktygsloop med fejkad klient kör SQL och returnerar svar + frågor', async () => {
  const { db } = tmpDb();
  loadFixture(db, fixture);
  let call = 0;
  const seen = [];
  const client = { beta: { messages: { create: async (params) => {
    seen.push(params);
    call++;
    if (call === 1) {
      return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'run_sql',
        input: { sql: "SELECT ROUND(SUM(effective_amount),2) s FROM cost_lines", purpose: 'Total' } }] };
    }
    const result = params.messages.at(-1).content[0];
    return { stop_reason: 'end_turn', content: [{ type: 'text', text: `Totalt: ${JSON.parse(result.content).rows[0].s}` }] };
  } } } };
  const r = await ask(db, { question: 'Total?', scope: {} }, { client });
  assert.match(r.answer, /Totalt: 26793/);
  assert.equal(r.queries.length, 1);
  assert.equal(seen[0].model, 'claude-opus-5-5');
  assert.equal(seen[0].tools[0].name, 'run_sql');
});

test('extract: skickar PDF som dokument och tolkar JSON-svaret', async () => {
  let params;
  const client = { beta: { messages: { stream: (p) => {
    params = p;
    return { finalMessage: async () => ({ stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify(fixture.submissions[0].extraction) }] }) };
  } } } };
  const ex = await extractSubmission([{ original_name: 'a.pdf', mime_type: 'application/pdf', data: Buffer.from('%PDF-1.4 test').toString('base64') }],
    { client, projectName: 'P' });
  assert.equal(ex.invoices.length, 2);
  assert.equal(params.output_config.format.type, 'json_schema');
  assert.equal(params.messages[0].content[1].type, 'document');
});
