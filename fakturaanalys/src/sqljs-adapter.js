'use strict';
// Gör en sql.js-databas (SQLite som WebAssembly) kompatibel med det node:sqlite-API som resten av
// koden använder: db.prepare(sql).all/get/run och db.exec. Används i appen på iPhone/iPad.

const norm = (params) => params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));
const isWrite = (sql) => !/^\s*(select|with|pragma\s+(table_info|query_only))\b/i.test(sql);

function adapt(sqlDb, { onChange = () => {} } = {}) {
  let inTx = false;
  const changed = () => { if (!inTx) onChange(); };
  const prepare = (sql) => {
    const all = (...p) => {
      const st = sqlDb.prepare(sql);
      try {
        st.bind(norm(p));
        const rows = [];
        while (st.step()) rows.push(st.getAsObject());
        return rows;
      } finally { st.free(); }
    };
    return {
      all,
      get: (...p) => all(...p)[0],
      run: (...p) => {
        sqlDb.run(sql, norm(p));
        const changes = sqlDb.getRowsModified();
        const lastInsertRowid = sqlDb.exec('SELECT last_insert_rowid()')[0].values[0][0];
        if (isWrite(sql)) changed();
        return { changes, lastInsertRowid };
      },
    };
  };
  const exec = (sql) => {
    if (/^\s*BEGIN\b/i.test(sql)) inTx = true;
    sqlDb.exec(sql);
    if (/^\s*(COMMIT|ROLLBACK)\b/i.test(sql)) { inTx = false; onChange(); } else if (isWrite(sql)) changed();
  };
  return {
    prepare,
    exec,
    get inTransaction() { return inTx; },
    // Hela databasen som bytes (för lagring på enheten och säkerhetskopia)
    export() {
      const bytes = sqlDb.export();
      sqlDb.exec('PRAGMA foreign_keys = ON;'); // export() återställer pragman i sql.js
      return bytes;
    },
    close: () => sqlDb.close(),
  };
}

module.exports = { adapt };
