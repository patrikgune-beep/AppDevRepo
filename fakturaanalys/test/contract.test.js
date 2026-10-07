'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { open } = require('../src/node-db');
const { loadFixture } = require('../src/demo');
const { saveContract, normalizeContract } = require('../src/contract-extract');
const { runContractChecks, buildReviewPrompt, storeReview, matchRate } = require('../src/contract-check');
const { kindFromPath } = require('../src/importer');
const fixture = require('../fixtures/karlavagen71.json');

// Påhittat testavtal (inte ett riktigt avtal) med villkor som fakturorna bryter mot
const TEST_CONTRACT = normalizeContract({
  summary: 'Testavtal',
  warnings: [],
  documents: [{
    doc_type: 'kontrakt', title: 'Entreprenadkontrakt (test)', source_file: 'kontrakt.pdf', pages: '1-4', doc_date: '2026-08-01',
    counterparty: 'Thessén & Ek Byggentreprenad AB', counterparty_orgnr: '556818-1092', contract_form: 'lopande_rakning',
    fixed_price: null, agreement_standard: 'AB 04', markup_ue_pct: 10, markup_material_pct: 10, payment_days: 30,
    ata_requires_written_order: true,
    rates: [
      { description: 'Rivning, timpris', cost_category: 'arbete', trade: 'rivning', material_type: null, unit: 'h', unit_price: 450, page: '3', quote: 'Rivningsarbete 450 kr/tim' },
      { description: 'Arbetsledning', cost_category: 'arbetsledning', trade: 'arbetsledare', material_type: null, unit: 'h', unit_price: 680, page: '3', quote: 'Arbetsledning 680 kr/tim' },
    ],
    clauses: [
      { kind: 'ingar', text: 'Parkering och servicebil ingår i timpriserna.', page: '2' },
      { kind: 'ata', text: 'ÄTA-arbeten ska beställas skriftligt innan de påbörjas.', page: '4' },
    ],
  }],
});

function setup() {
  const db = open(':memory:');
  const pid = loadFixture(db, fixture);
  const sid = Number(db.prepare("INSERT INTO submissions (project_id, label, kind) VALUES (?, 'Avtal', 'avtal')").run(pid).lastInsertRowid);
  saveContract(db, sid, pid, TEST_CONTRACT);
  runContractChecks(db, pid);
  return { db, pid };
}
const byType = (db, t) => db.prepare('SELECT * FROM review_findings WHERE check_type = ? ORDER BY id').all(t);

test('fel timpris: rivning 481,60 kr/h mot avtalade 450 kr/h', () => {
  const { db } = setup();
  const f = byType(db, 'fel_pris');
  assert.equal(f.length, 2); // två fakturor med rivningstimmar (19 h och 86 h)
  const total = f.reduce((s, x) => s + x.amount, 0);
  assert.ok(Math.abs(total - 31.6 * 105) < 0.05, `total ${total}`);
  assert.match(f[0].contract_ref, /Rivningsarbete 450 kr\/tim/);
  // arbetsledning 680 kr/h stämmer med avtalet och flaggas inte
  assert.ok(!f.some((x) => /Arbetsledning/.test(x.title)));
});

test('för högt påslag: 12 % mot avtalade 10 %', () => {
  const { db } = setup();
  const f = byType(db, 'fel_paslag');
  const amounts = Object.fromEntries(f.map((x) => [x.title.match(/\d{5,}/)[0], x.amount]));
  // 22 960 − 20 500 × 1,10 = 410, minus 2 % på rader som redan flaggats för fel pris eller för att ingå
  // i avtalet (rivning 8 170 + servicebil 950 + parkering 245 kr) = 410 − 187,30
  assert.equal(amounts['33869'], 222.7);
  // 55 988,80 − 49 990 × 1,10 = 999,80, minus 2 % på rivning 36 980 kr (ÄTA: servicebil/parkering flaggas inte)
  assert.equal(amounts['33864'], 260.2);
  assert.ok(Math.abs(amounts['183677491'] - 81.44) < 0.01);
  assert.equal(amounts['260980851828'], undefined); // Beijer avviker redan och bedöms inte här
});

test('poster som ingår enligt avtalet: parkering och servicebil', () => {
  const { db } = setup();
  const f = byType(db, 'ingar_i_avtal');
  const titles = f.map((x) => x.title);
  assert.ok(titles.some((t) => /Servicebil/.test(t)));
  assert.ok(titles.some((t) => /Parkering/.test(t)));
  assert.ok(!titles.some((t) => /Rivning/.test(t)));
  // ÄTA-fakturans servicebil/parkering bedöms inte som "ingår" (ÄTA hanteras separat)
  assert.ok(f.every((x) => x.invoice_number !== '33864'));
});

test('ÄTA utan skriftlig beställning och för kort betalningstid', () => {
  const { db } = setup();
  const ata = byType(db, 'ata');
  assert.equal(ata.length, 1);
  assert.match(ata[0].title, /132370/);
  const pay = byType(db, 'betalningsvillkor');
  assert.equal(pay.length, 1);
  assert.match(pay[0].detail, /10 dagars betalningstid mot avtalade 30/);
});

test('ingen dubbelräkning: summan av fynd = faktisk överdebitering', () => {
  const { db } = setup();
  const sum = (t) => db.prepare('SELECT COALESCE(SUM(amount),0) s FROM review_findings WHERE check_type = ?').get(t).s;
  // Rivning: 105 h × (481,60 − 450) = 3 318. Påslag 2 % över avtalet på övriga rader i UE-fakturorna:
  // 33869: (20 500 − 8 170 − 950 − 245) × 2 % = 222,70; 33864: (49 990 − 36 980) × 2 % = 260,20; Big Bag 81,44.
  // Servicebil + parkering (33869) som ingår i avtalet: 1 064 + 274,40.
  const total = sum('fel_pris') + sum('fel_paslag') + sum('ingar_i_avtal');
  assert.ok(Math.abs(total - (3318 + 222.7 + 260.2 + 81.44 + 1064 + 274.4)) < 0.1, `total ${total}`);
});

test('godkänd avvikelse visas inte igen efter ny kontroll', () => {
  const { db, pid } = setup();
  const f = byType(db, 'betalningsvillkor')[0];
  db.prepare('INSERT INTO review_dismissed (project_id, dedupe_key) VALUES (?, ?)').run(pid, f.dedupe_key);
  runContractChecks(db, pid);
  assert.equal(byType(db, 'betalningsvillkor').length, 0);
});

test('utan avtal: inga avtalsfynd', () => {
  const db = open(':memory:');
  const pid = loadFixture(db, fixture);
  runContractChecks(db, pid);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM review_findings').get().n, 0);
});

test('matchRate väljer högsta priset vid flera lika träffar', () => {
  const rates = [
    { description: 'Snickare vardag', trade: 'snickare', unit: 'h', unit_price: 600, cost_category: 'arbete' },
    { description: 'Snickare kväll', trade: 'snickare', unit: 'h', unit_price: 800, cost_category: 'arbete' },
  ];
  assert.equal(matchRate({ description: 'Snickeri', trade: 'snickare', unit: 'h', cost_category: 'arbete' }, rates).unit_price, 800);
  assert.equal(matchRate({ description: 'Snickeri', trade: 'snickare', unit: 'st', cost_category: 'arbete' }, rates), null);
});

test('Claudes bedömning: underlag och lagring med radkoppling', () => {
  const { db, pid } = setup();
  const prompt = buildReviewPrompt(db, pid);
  assert.match(prompt, /Rivning, timpris: 450 kr\/h/);
  assert.match(prompt, /Parkering och servicebil ingår/);
  assert.match(prompt, /REDAN HITTAT/);
  const line = db.prepare("SELECT id FROM line_items WHERE description LIKE 'Sophantering 6/8%'").get();
  const n = storeReview(db, pid, { findings: [
    { check_type: 'ej_debiterbar', severity: 'varning', line_ids: [line.id, 999999], title: 'Sophantering före arbetsstart', detail: 'Perioden 6/8 ligger före rivningen.', contract_ref: 'Kontrakt s. 2', amount: 8400 },
  ] });
  assert.equal(n, 1);
  const f = db.prepare("SELECT * FROM review_findings WHERE source = 'bedomning'").get();
  assert.equal(f.line_id, line.id);
  assert.equal(f.amount, 8400);
});

test('filer i mappen "Avtal" eller "Kontrakt" läses in som avtal', () => {
  assert.equal(kindFromPath('Avtal/kontrakt.pdf'), 'avtal');
  assert.equal(kindFromPath('Kontrakt och bilagor/prislista.pdf'), 'avtal');
  assert.equal(kindFromPath('Offert Thessén/offert.pdf'), 'avtal');
  assert.equal(kindFromPath('Faktura 132387/huvud.pdf'), 'faktura');
  assert.equal(kindFromPath('offert.pdf'), 'faktura'); // bara mappnamnet avgör
});

test('avtalstolkning med API-nyckel: PDF skickas som dokument, svaret normaliseras', async () => {
  const { createSdkLlm } = require('../src/llm');
  let params;
  const client = { beta: { messages: { stream: (p) => { params = p; return { finalMessage: async () => ({ stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify({ summary: 's', warnings: [], documents: [{ ...TEST_CONTRACT.documents[0], markup_ue_pct: '10 %' }] }) }] }) }; } } } };
  const llm = createSdkLlm({ getApiKey: async () => 'k', makeClient: () => client, toBase64: async () => 'JVBERi0=' });
  const cx = await llm.extractContract([{ original_name: 'kontrakt.pdf', mime_type: 'application/pdf', blob: null }]);
  assert.equal(params.output_config.format.type, 'json_schema');
  assert.equal(params.messages[0].content[1].type, 'document');
  assert.equal(cx.documents[0].markup_ue_pct, 10);
  assert.equal(cx.documents[0].rates.length, 2);
});
