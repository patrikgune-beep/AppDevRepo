'use strict';
// SQLite i Node (används av tester och skript). Appen på enheten använder src/web-db.js.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const { init } = require('./schema');

function open(dbPath) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  return init(new DatabaseSync(dbPath));
}

module.exports = { open };
