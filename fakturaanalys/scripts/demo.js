'use strict';
// Läser in exemplet (två fakturor för Karlavägen 71) utan AI-anrop, från färdigtolkad fixture.
const path = require('path');
const { open } = require('../src/db');
const { saveExtraction, reconcile } = require('../src/store');

function loadFixture(db, fixture) {
  const existing = db.prepare('SELECT id FROM projects WHERE name = ?').get(fixture.project.name);
  if (existing) db.prepare('DELETE FROM projects WHERE id = ?').run(existing.id);
  const pid = Number(db.prepare('INSERT INTO projects (name, description) VALUES (?, ?)')
    .run(fixture.project.name, fixture.project.description).lastInsertRowid);
  for (const s of fixture.submissions) {
    const sid = Number(db.prepare("INSERT INTO submissions (project_id, label, status) VALUES (?, ?, 'processing')")
      .run(pid, s.label).lastInsertRowid);
    saveExtraction(db, sid, pid, s.extraction);
  }
  reconcile(db, pid);
  return pid;
}

if (require.main === module) {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const db = open(path.join(dataDir, 'fakturor.db'));
  const pid = loadFixture(db, require('../fixtures/karlavagen71.json'));
  console.log(`Demoprojekt inläst (id ${pid}).`);
}

module.exports = { loadFixture };
