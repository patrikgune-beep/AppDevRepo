'use strict';
// Läser in exemplet (två fakturor för Karlavägen 71) från färdigtolkad data, utan AI-anrop.
const { saveExtraction, reconcile } = require('./store');

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

module.exports = { loadFixture };
