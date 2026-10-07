'use strict';
// Databasschema, migrering och transaktioner. Oberoende av SQLite-motor: fungerar med
// node:sqlite (tester) och sql.js (i appen på iPhone/iPad).

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ett "underlag" = en uppladdning (en eller flera filer som hör ihop).
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'pending',      -- pending | processing | done | error
  error TEXT,
  summary TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  ref TEXT NOT NULL,
  kind TEXT NOT NULL,                 -- huvudfaktura | underleverantorsfaktura | kvitto | kreditfaktura | ovrigt
  source_file TEXT,
  pages TEXT,
  supplier_name TEXT,
  supplier_orgnr TEXT,
  invoice_number TEXT,
  invoice_date TEXT,
  due_date TEXT,
  period_start TEXT,
  period_end TEXT,
  project_label TEXT,
  currency TEXT,
  amount_excl_vat REAL,
  vat_amount REAL,
  amount_incl_vat REAL,
  reverse_charge_vat INTEGER NOT NULL DEFAULT 0,
  -- Avstämning mot raden på huvudfakturan som vidarefakturerar denna bilaga
  billed_amount REAL,                 -- belopp på huvudfakturans rad
  billed_ratio REAL,                  -- billed_amount / amount_excl_vat
  markup_status TEXT,                 -- ok | avvikelse | saknar_rad | ej_tillampligt
  is_duplicate INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS line_items (
  id INTEGER PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  description TEXT NOT NULL,
  line_date TEXT,
  article_no TEXT,
  quantity REAL,
  unit TEXT,                          -- normaliserad enhet: h, st, m, m2, m3, kg, ton ...
  unit_raw TEXT,
  unit_price REAL,                    -- leverantörens à-pris exkl moms
  amount_excl_vat REAL,               -- leverantörens radbelopp exkl moms
  cost_category TEXT NOT NULL,
  trade TEXT,                         -- yrkeskategori för arbetstid
  resource_name TEXT,
  material_type TEXT,
  attachment_invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  -- Härledda fält (beräknas av reconcile())
  counted INTEGER NOT NULL DEFAULT 1, -- 1 = ingår i projektets kostnad (inga dubbletter)
  alloc_factor REAL,                  -- faktor som gör att summan stämmer mot det som fakturerats beställaren
  markup_factor REAL,                 -- påslag från huvudentreprenören (1.12 = 12 %)
  markup_assumed INTEGER NOT NULL DEFAULT 0,
  effective_amount REAL,              -- kostnad för beställaren exkl moms
  effective_unit_price REAL,          -- à-pris för beställaren exkl moms (inkl påslag)
  work_month TEXT,                    -- YYYY-MM då arbetet/leveransen skedde
  invoice_month TEXT,                 -- YYYY-MM enligt huvudfakturans datum
  supplier_name TEXT,                 -- den leverantör som utförde/levererade
  billed_by TEXT,                     -- den som fakturerade beställaren
  edited INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS supporting_docs (
  id INTEGER PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  doc_type TEXT,
  title TEXT,
  source_file TEXT,
  pages TEXT,
  period_start TEXT,
  period_end TEXT,
  text_summary TEXT
);

CREATE TABLE IF NOT EXISTS findings (
  id INTEGER PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  severity TEXT NOT NULL,             -- info | varning
  source TEXT NOT NULL DEFAULT 'tolkning', -- tolkning | avstamning
  message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_lines_project ON line_items(project_id, counted);
CREATE INDEX IF NOT EXISTS ix_inv_project ON invoices(project_id);

-- Analysvy: en rad per kostnadsrad som ingår i projektets kostnad.
CREATE VIEW IF NOT EXISTS cost_lines AS
SELECT li.id AS line_id, li.project_id, p.name AS project_name,
       li.invoice_id, i.invoice_number, i.kind AS invoice_kind,
       li.supplier_name, li.billed_by,
       li.line_date, li.work_month, li.invoice_month,
       li.description, li.cost_category, li.trade, li.resource_name, li.material_type,
       li.quantity, li.unit, li.unit_price, li.amount_excl_vat,
       li.markup_factor, li.markup_assumed, li.effective_unit_price, li.effective_amount
FROM line_items li
JOIN invoices i ON i.id = li.invoice_id
JOIN projects p ON p.id = li.project_id
WHERE li.counted = 1;
`;

// Gemensamt filindex för mappsynk: om sökväg, storlek och ändringstid är oförändrade behöver
// filen inte läsas igen för att räkna ut hashen.
const EXTRA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);

-- Avtalsunderlag: kontrakt, offert, kontraktsbilagor och ÄTA-beställningar (ett per dokument)
CREATE TABLE IF NOT EXISTS contract_terms (
  id INTEGER PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,              -- kontrakt | offert | kontraktsbilaga | prislista | ata_bestallning | ovrigt
  title TEXT,
  source_file TEXT,
  pages TEXT,
  doc_date TEXT,
  counterparty TEXT,                   -- entreprenören/leverantören
  counterparty_orgnr TEXT,
  contract_form TEXT,                  -- fast_pris | lopande_rakning | riktpris | blandat | okand
  fixed_price REAL,                    -- avtalat fast pris exkl. moms
  agreement_standard TEXT,             -- t.ex. AB 04, ABT 06, ABS 18, konsumenttjänstlagen
  markup_ue_pct REAL,                  -- avtalat påslag på underentreprenörer, %
  markup_material_pct REAL,            -- avtalat påslag på material, %
  payment_days INTEGER,
  ata_requires_written_order INTEGER,  -- 1 = ÄTA ska beställas skriftligt
  summary TEXT
);
CREATE TABLE IF NOT EXISTS contract_rates (
  id INTEGER PRIMARY KEY,
  terms_id INTEGER NOT NULL REFERENCES contract_terms(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  cost_category TEXT,
  trade TEXT,
  material_type TEXT,
  unit TEXT,
  unit_price REAL,                     -- avtalat à-pris exkl. moms (det beställaren ska betala)
  page TEXT,
  quote TEXT,                          -- ordagrann text ur avtalet
  edited INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS contract_clauses (
  id INTEGER PRIMARY KEY,
  terms_id INTEGER NOT NULL REFERENCES contract_terms(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                  -- ingar | ingar_ej | ata | fakturering | ovrigt
  text TEXT NOT NULL,
  page TEXT
);
-- Resultat av avtalskontrollen. source: kontroll (beräknad) | bedomning (Claude)
CREATE TABLE IF NOT EXISTS review_findings (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  check_type TEXT NOT NULL,            -- fel_pris | fel_paslag | ingar_i_avtal | saknar_avtalspris | over_fast_pris | betalningsvillkor | ata | ovrigt
  severity TEXT NOT NULL,              -- varning | info
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  line_id INTEGER REFERENCES line_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  detail TEXT,
  contract_ref TEXT,
  amount REAL,                         -- möjlig överdebitering exkl. moms
  dedupe_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Avvikelser som användaren har godkänt ("OK") visas inte igen
CREATE TABLE IF NOT EXISTS review_dismissed (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dedupe_key TEXT NOT NULL,
  PRIMARY KEY (project_id, dedupe_key)
);
-- Frågor som användaren ställt (sparas automatiskt) och favoriter
CREATE TABLE IF NOT EXISTS saved_questions (
  id INTEGER PRIMARY KEY,
  text TEXT NOT NULL,
  norm TEXT NOT NULL UNIQUE,
  favorite INTEGER NOT NULL DEFAULT 0,
  times_asked INTEGER NOT NULL DEFAULT 0,
  last_asked_at TEXT,
  last_answer TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS file_index (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rel_path TEXT NOT NULL,
  size INTEGER NOT NULL,
  modified REAL NOT NULL,
  sha256 TEXT NOT NULL,
  PRIMARY KEY (project_id, rel_path)
);`;

function init(db) {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  migrate(db);
  db.exec(EXTRA);
  return db;
}

// Lägger till kolumner/tabeller i databaser som skapades av en tidigare version.
function migrate(db) {
  const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  const add = (t, col, def) => { if (!cols(t).includes(col)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${col} ${def}`); };
  add('files', 'sha256', 'TEXT');
  add('files', 'rel_path', 'TEXT');               // sökväg i den synkade mappen
  add('projects', 'folder_path', 'TEXT');         // projektets fakturamapp, relativt FAKTURA_ROOT
  add('projects', 'last_synced_at', 'TEXT');
  add('submissions', 'read_log', 'TEXT');          // JSON: sidor, text/skannat, omgångar, ej tolkade sidor
  add('submissions', 'kind', "TEXT NOT NULL DEFAULT 'faktura'"); // faktura | avtal
  db.exec(`CREATE INDEX IF NOT EXISTS ix_files_sha ON files(sha256);
    -- Filer som användaren tagit bort ska inte läsas in igen vid nästa synk.
    CREATE TABLE IF NOT EXISTS ignored_files (
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      sha256 TEXT NOT NULL,
      PRIMARY KEY (project_id, sha256)
    );`);
}

function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = { SCHEMA, init, migrate, tx };
